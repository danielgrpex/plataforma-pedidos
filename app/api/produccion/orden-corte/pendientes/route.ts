import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}
function toNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Intenta sacar largo desde "Producto|Color|Ancho|Largo|Acabados"
function parseLargoFromPipeText(texto: string) {
  const t = toStr(texto);
  if (!t.includes("|")) return 0;
  const parts = t.split("|");
  return toNumber(parts?.[3]);
}

function findCol(headers: any[], candidates: string[]) {
  const h = headers.map((x) => norm(x));
  for (const c of candidates) {
    const idx = h.indexOf(norm(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const sheets = await getSheetsClient();

    // 1) Leer Pedidos (A:AZ por seguridad)
    const pedRange = "Pedidos!A:AZ";
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: pedRange,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const pedValues = (pedResp.data.values || []) as any[][];
    const headers = pedValues[0] || [];
    const pedRows = pedValues.length > 1 ? pedValues.slice(1) : [];

    // ✅ DEBUG SIEMPRE DISPONIBLE (aunque venga vacío)
    if (debug) {
      return NextResponse.json({
        success: true,
        debug: {
          spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
          range: pedRange,
          totalRowsIncludingHeader: pedValues.length,
          headersPreview: headers.slice(0, 30),
          firstRowPreview: (pedRows[0] || []).slice(0, 30),
        },
      });
    }

    if (pedValues.length < 2) {
      return NextResponse.json({ success: true, items: [] });
    }

    // Buscar columnas por encabezado (pon aquí los nombres reales si difieren)
    const IDX_CONSEC = findCol(headers, ["Consecutivo", "consecutivo", "Pedido", "#"]);
    const IDX_CLIENTE = findCol(headers, ["Cliente", "cliente"]);
    const IDX_OC = findCol(headers, ["OC", "oc", "Orden Compra", "orden compra"]);
    const IDX_PRODUCTO = findCol(headers, ["Producto", "producto", "Producto Solicitado", "producto solicitado"]);
    const IDX_CANTUND = findCol(headers, ["Cantidad (und)", "Cant (und)", "cantidad (und)", "cantidad"]);
    const IDX_ESTADO = findCol(headers, [
      "Estado Planeación",
      "Estado Planeacion",
      "Estado",
      "estado",
      "estado planeacion",
      "estado planeación",
      "EstadoPlaneacion",
    ]);
    const IDX_PEDIDOKEY = findCol(headers, [
      "PedidoKey",
      "pedidoKey",
      "pedido_key",
      "Key",
      "ID Pedido",
      "pedido id",
    ]);

    const missing: string[] = [];
    if (IDX_ESTADO < 0) missing.push("Estado / Estado Planeación");
    if (IDX_PEDIDOKEY < 0) missing.push("PedidoKey");

    if (missing.length) {
      return NextResponse.json(
        { success: false, message: `No encuentro columnas: ${missing.join(", ")}. Revisa headers en la hoja Pedidos.` },
        { status: 400 }
      );
    }

    // Filtra pendientes con comparación robusta
    const pendientes = pedRows
      .map((r, i) => ({ r, rowIndex1Based: i + 2 }))
      .filter((x) => norm(x.r[IDX_ESTADO]) === "corte");

    if (!pendientes.length) {
      return NextResponse.json({ success: true, items: [] });
    }

    // 2) Leer MovimientosInventario (para reservas)
    const movRange = "MovimientosInventario!A:L";
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: movRange,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // Índices Movimientos
    const M_IDX_INVID = 1; // B
    const M_IDX_TIPO = 2; // C
    const M_IDX_QTYUND = 3; // D
    const M_IDX_PEDIDOKEY = 7; // H
    const M_IDX_REF = 8; // I
    const M_IDX_FECHA = 10; // K

    // Mapa por (pedidoKey|rowIndex) usando ref PLN-R{row}
    const reservaByPedidoRow: Record<string, { inventarioId: string; qtyUnd: number; ts: string }> = {};

    for (const m of movRows) {
      if (toStr(m[M_IDX_TIPO]) !== "Reserva") continue;

      const pedidoKey = toStr(m[M_IDX_PEDIDOKEY]);
      const invId = toStr(m[M_IDX_INVID]);
      const qty = toNumber(m[M_IDX_QTYUND]); // negativa
      const ref = toStr(m[M_IDX_REF]);
      const ts = toStr(m[M_IDX_FECHA]) || "";

      if (!pedidoKey || !invId) continue;

      const match = ref.match(/^PLN-R(\d+)$/);
      const rowFromRef = match ? Number(match[1] || 0) : 0;
      if (!rowFromRef) continue;

      const key = `${pedidoKey}|${rowFromRef}`;

      const prev = reservaByPedidoRow[key];
      if (!prev) {
        reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
      } else {
        if (ts && prev.ts && ts > prev.ts) reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
        else if (!prev.ts && ts) reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
      }
    }

    // 3) Leer Inventario (para enriquecer origen)
    const invRange = "Inventario!A:AB";
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: invRange,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    // Inventario idx:
    // A id (0)
    // D productoKey (3)
    // E descripcion (4)
    // I largo (8)
    const invMap: Record<string, { productoOrigen: string; largoOrigen: number; productoKey: string }> = {};
    for (const r of invRows) {
      const invId = toStr(r?.[0]);
      if (!invId) continue;

      const descripcion = toStr(r?.[4]) || toStr(r?.[3]) || "";
      const largoCol = toNumber(r?.[8]);
      const largoPipe = parseLargoFromPipeText(descripcion);
      const largo = largoCol || largoPipe || 0;

      invMap[invId] = {
        productoOrigen: descripcion,
        largoOrigen: largo,
        productoKey: toStr(r?.[3]),
      };
    }

    // 4) Armar respuesta final (shape que espera tu UI)
    const items = pendientes.map((p) => {
      const row = p.rowIndex1Based;
      const pedidoKey = toStr(p.r[IDX_PEDIDOKEY]);

      const reserva = reservaByPedidoRow[`${pedidoKey}|${row}`];
      const inventarioOrigenId = reserva?.inventarioId || "";
      const cantidadOrigenUnd = reserva ? Math.abs(reserva.qtyUnd || 0) : 0;

      const inv = inventarioOrigenId ? invMap[inventarioOrigenId] : null;

      return {
        rowIndex1Based: row,
        pedidoKey,
        consecutivo: IDX_CONSEC >= 0 ? toStr(p.r[IDX_CONSEC]) : "",
        cliente: IDX_CLIENTE >= 0 ? toStr(p.r[IDX_CLIENTE]) : "",
        oc: IDX_OC >= 0 ? toStr(p.r[IDX_OC]) : "",
        productoSolicitado: IDX_PRODUCTO >= 0 ? toStr(p.r[IDX_PRODUCTO]) : "",
        cantidadSolicitadaUnd: IDX_CANTUND >= 0 ? toNumber(p.r[IDX_CANTUND]) : 0,
        estadoPlaneacion: "Corte",

        inventarioOrigenId,
        cantidadOrigenUnd,
        productoOrigen: inv?.productoOrigen || "",
        largoOrigen: inv?.largoOrigen || 0,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[produccion/corte/pendientes]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando pendientes de corte",
      },
      { status: 500 }
    );
  }
}

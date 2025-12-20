// app/api/produccion/corte/pendientes/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
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

export async function GET() {
  try {
    const sheets = await getSheetsClient();

    // 1) Leer Pedidos
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const pedValues = (pedResp.data.values || []) as any[][];
    const pedRows = pedValues.length > 1 ? pedValues.slice(1) : [];

    // Índices (0-based) de Pedidos
    const P_IDX_CONSEC = 0;
    const P_IDX_CLIENTE = 3;
    const P_IDX_OC = 5;
    const P_IDX_PRODUCTO = 6; // producto texto
    const P_IDX_CANTUND = 11;
    const P_IDX_ESTADO_PLANEACION = 22; // W en tu layout final
    const P_IDX_PEDIDOKEY = 37; // AL

    const pendientes = pedRows
      .map((r, i) => ({ r, rowIndex1Based: i + 2 }))
      .filter((x) => toStr(x.r[P_IDX_ESTADO_PLANEACION]) === "Corte");

    if (!pendientes.length) {
      return NextResponse.json({ success: true, items: [] });
    }

    // 2) Leer MovimientosInventario (para reservas)
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
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
    const M_IDX_FECHA = 10; // K (si está)

    // Mapa por (pedidoKey|rowIndex)
    // Soporta ref PLN-R{row}
    const reservaByPedidoRow: Record<string, { inventarioId: string; qtyUnd: number; ts: string }> = {};

    for (const m of movRows) {
      if (toStr(m[M_IDX_TIPO]) !== "Reserva") continue;

      const pedidoKey = toStr(m[M_IDX_PEDIDOKEY]);
      const invId = toStr(m[M_IDX_INVID]);
      const qty = toNumber(m[M_IDX_QTYUND]); // negativa
      const ref = toStr(m[M_IDX_REF]);
      const ts = toStr(m[M_IDX_FECHA]) || "";

      if (!pedidoKey || !invId) continue;

      let rowFromRef = 0;
      const match = ref.match(/^PLN-R(\d+)$/);
      if (match) rowFromRef = Number(match[1] || 0);

      // Si no se pudo parsear, no lo usamos para join por fila (evitamos asignar mal)
      if (!rowFromRef) continue;

      const key = `${pedidoKey}|${rowFromRef}`;

      // Si hay varios, nos quedamos con el más reciente (por ts si existe)
      const prev = reservaByPedidoRow[key];
      if (!prev) {
        reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
      } else {
        // compara timestamps si hay
        if (ts && prev.ts && ts > prev.ts) {
          reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
        } else if (!prev.ts && ts) {
          reservaByPedidoRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
        }
      }
    }

    // 3) Leer Inventario (para enriquecer origen)
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
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

    // 4) Armar respuesta final
    const items = pendientes.map((p) => {
      const row = p.rowIndex1Based;
      const pedidoKey = toStr(p.r[P_IDX_PEDIDOKEY]);

      const reserva = reservaByPedidoRow[`${pedidoKey}|${row}`];
      const inventarioOrigenId = reserva?.inventarioId || "";
      const cantidadOrigenUnd = reserva ? Math.abs(reserva.qtyUnd || 0) : 0;

      const inv = inventarioOrigenId ? invMap[inventarioOrigenId] : null;

      return {
        rowIndex1Based: row,
        pedidoKey,
        consecutivo: toStr(p.r[P_IDX_CONSEC]),
        cliente: toStr(p.r[P_IDX_CLIENTE]),
        oc: toStr(p.r[P_IDX_OC]),
        productoSolicitado: toStr(p.r[P_IDX_PRODUCTO]),
        cantidadSolicitadaUnd: toNumber(p.r[P_IDX_CANTUND]),
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
      { success: false, message: error instanceof Error ? error.message : "Error cargando pendientes de corte" },
      { status: 500 }
    );
  }
}


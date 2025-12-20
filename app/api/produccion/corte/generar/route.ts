// app/api/produccion/corte/generar/route.ts
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

type Body = {
  items?: Array<{
    rowIndex1Based: number;
    actividades?: string; // "Cortar|Limpiar|..."
  }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    // Mapa actividades por fila (rowIndex1Based)
    const actsByRow: Record<number, string> = {};
    for (const it of body?.items || []) {
      const row = Number(it?.rowIndex1Based || 0);
      if (!row) continue;
      const acts = toStr(it?.actividades) || "Cortar";
      actsByRow[row] = acts;
    }

    const sheets = await getSheetsClient();

    // 1) Leer Pedidos
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const pedValues = (pedResp.data.values || []) as any[][];
    const pedRows = pedValues.length > 1 ? pedValues.slice(1) : [];

    // Columnas importantes (0-based):
    // productoSolicitado = G (idx 6)
    // cantidadUnd = L (idx 11)
    // estadoPlaneacion = W (idx 22)   (según tu código actual)
    // pedidoKey = AL (idx 37)
    const P_IDX_PRODUCTO = 6;
    const P_IDX_CANTUND = 11;
    const P_IDX_ESTADO_PLANEACION = 22;
    const P_IDX_PEDIDOKEY = 37;

    const pendientes = pedRows
      .map((r, i) => ({ r, rowIndex1Based: i + 2 }))
      .filter((x) => toStr(x.r[P_IDX_ESTADO_PLANEACION]) === "Corte");

    if (!pendientes.length) {
      return NextResponse.json(
        { success: false, message: "No hay items en estado Corte" },
        { status: 400 }
      );
    }

    // 2) Leer MovimientosInventario (para encontrar reservas)
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // Movimientos:
    // inventarioId = B idx1
    // tipo = C idx2
    // cantidadUnd = D idx3 (negativa reserva)
    // pedidoKey = H idx7
    // referenciaOperacion = I idx8 (PLN-R{row})
    const M_IDX_INVID = 1;
    const M_IDX_TIPO = 2;
    const M_IDX_QTYUND = 3;
    const M_IDX_PEDIDOKEY = 7;
    const M_IDX_REF = 8;

    // index rápido: key = pedidoKey|ref
    const movMap: Record<string, { inventarioId: string; qtyUnd: number }> = {};
    for (const m of movRows) {
      if (toStr(m[M_IDX_TIPO]) !== "Reserva") continue;
      const pk = toStr(m[M_IDX_PEDIDOKEY]);
      const ref = toStr(m[M_IDX_REF]);
      const invId = toStr(m[M_IDX_INVID]);
      const qty = toNumber(m[M_IDX_QTYUND]);
      if (!pk || !ref || !invId) continue;
      movMap[`${pk}|${ref}`] = { inventarioId: invId, qtyUnd: qty };
    }

    // 3) Leer Inventario (para resolver productoOrigen + largoOrigen)
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    /**
     * Inventario (según tu estructura usada antes):
     * A inventarioId (idx 0)
     * E productoDescripcion (idx 4)
     * I largo (idx 8)
     */
    const invMap: Record<string, { productoOrigen: string; largoOrigen: number }> = {};
    for (const r of invRows) {
      const invId = toStr(r?.[0]);
      if (!invId) continue;

      const productoDesc = toStr(r?.[4]);
      const largo = toNumber(r?.[8]);

      invMap[invId] = {
        productoOrigen: productoDesc,
        largoOrigen: largo,
      };
    }

    // 4) Consecutivo OrdenCorte
    const ocResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "OrdenCorte!A:B",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const ocValues = (ocResp.data.values || []) as any[][];
    const ocCount = Math.max(0, ocValues.length - 1);
    const ordenCorteId = `OC-${String(ocCount + 1).padStart(6, "0")}`;

    // 5) Crear OrdenCorte (cabecera)
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "OrdenCorte!A:Z",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[ordenCorteId, now]] },
    });

    // 6) Crear OrdenCorte_Items (con inventarioOrigenId + productoOrigen + largoOrigen + actividades)
    // Tu hoja (según screenshot):
    // A ordenCorteItemId
    // B ordenCorteId
    // C pedidoKey
    // D pedidoRowIndex
    // E productoSolicitado
    // F cantidadSolicitadaUnd
    // G destinoFinal
    // H estadoItem
    // I inventarioOrigenId
    // J productoOrigen
    // K largoOrigen
    // L cantidadOrigenUnd
    // M cantidadOrigenM
    // N largoFinal
    // O actividades
    const itemsToAppend: any[][] = [];
    let itemNum = 0;

    for (const p of pendientes) {
      const pedidoKey = toStr(p.r[P_IDX_PEDIDOKEY]);
      const productoSolicitado = toStr(p.r[P_IDX_PRODUCTO]);
      const cantUnd = toNumber(p.r[P_IDX_CANTUND]);
      const row = p.rowIndex1Based;

      const ref = `PLN-R${row}`;
      const mv = movMap[`${pedidoKey}|${ref}`];

      const inventarioOrigenId = mv?.inventarioId || "";
      const cantidadOrigenUnd = mv ? Math.abs(mv.qtyUnd) : 0;

      const invInfo = inventarioOrigenId ? invMap[inventarioOrigenId] : undefined;
      const productoOrigen = invInfo?.productoOrigen || "";
      const largoOrigen = invInfo?.largoOrigen || 0;

      const actividades = actsByRow[row] || "Cortar";

      itemNum++;
      const ordenCorteItemId = `OCI-${String(itemNum).padStart(6, "0")}`;

      itemsToAppend.push([
        ordenCorteItemId,     // A
        ordenCorteId,         // B
        pedidoKey,            // C
        row,                  // D
        productoSolicitado,   // E
        cantUnd,              // F
        "Corte",              // G destinoFinal
        "Pendiente",          // H estadoItem
        inventarioOrigenId,   // I
        productoOrigen,       // J ✅
        largoOrigen || "",    // K ✅
        cantidadOrigenUnd,    // L
        "",                   // M cantidadOrigenM (si luego lo necesitas)
        "",                   // N largoFinal
        actividades,          // O ✅
      ]);
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "OrdenCorte_Items!A:Z",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: itemsToAppend },
    });

    // 7) Actualizar Pedidos: W y X -> "Corte Generado"
    const updateData: Array<{ range: string; values: any[][] }> = [];
    for (const p of pendientes) {
      const row = p.rowIndex1Based;
      updateData.push({
        range: `Pedidos!W${row}:X${row}`,
        values: [["Corte Generado", "Corte Generado"]],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updateData },
    });

    return NextResponse.json({
      success: true,
      ordenCorteId,
      itemsCreados: itemsToAppend.length,
      pedidosActualizados: updateData.length,
    });
  } catch (error) {
    console.error("[produccion/corte/generar]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error generando orden de corte",
      },
      { status: 500 }
    );
  }
}

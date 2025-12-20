// app/api/planeacion/pedido/guardar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

type Destino = "Almacén" | "Corte" | "Producción";

type Body = {
  pedidoKey: string;
  observacionesPlaneacion: string;
  usuario: string;
  items: Array<{
    rowIndex1Based: number;
    productoKey: string;
    destino: Destino;
    cantidadReservarUnd: number;
    inventarioId?: string | null; // ✅ NUEVO
  }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const pedidoKey = toStr(body.pedidoKey);
    if (!pedidoKey) {
      return NextResponse.json(
        { success: false, message: "pedidoKey requerido" },
        { status: 400 }
      );
    }

    const observacionesPlaneacion = toStr(body.observacionesPlaneacion);
    const usuario = toStr(body.usuario) || "planeacion";
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "items requeridos" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();
    const fecha = new Date().toISOString();

    // ✅ Validación en batch: leer AL{row} para todas las filas (1 sola llamada)
    const ranges = items
      .map((it) => Number(it.rowIndex1Based || 0))
      .filter((r) => r >= 2)
      .map((r) => `Pedidos!AL${r}:AL${r}`);

    const keyResp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const keyMap: Record<number, string> = {};
    (keyResp.data.valueRanges || []).forEach((vr: any) => {
      const range: string = vr.range || "";
      const m = range.match(/AL(\d+)/);
      const row = m ? Number(m[1]) : 0;
      const val = toStr(vr.values?.[0]?.[0] ?? "");
      if (row) keyMap[row] = val;
    });

    // ✅ Updates en batch (1 sola llamada)
    // Columnas:
    // S = Clasificación Planeación
    // T = Observaciones Planeación
    // U = Revisado Planeación
    // V = Fecha Revisión Planeación
    // W = Estado Planeación
    // X = Estado (general) -> lo ponemos igual que W
    const data: Array<{ range: string; values: any[][] }> = [];

    const debug: Array<{ row: number; ok: boolean; reason?: string }> = [];

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) {
        debug.push({ row, ok: false, reason: "rowIndex inválido" });
        continue;
      }

      const keyInSheet = keyMap[row] || "";
      if (keyInSheet !== pedidoKey) {
        debug.push({ row, ok: false, reason: `AL no coincide (AL=${keyInSheet})` });
        continue;
      }

      const destino = toStr(it.destino) as Destino;

      data.push({
        range: `Pedidos!S${row}:X${row}`,
        values: [[destino, observacionesPlaneacion, "TRUE", fecha, destino, destino]],
      });

      debug.push({ row, ok: true });
    }

    if (!data.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No se actualizó ninguna fila en Pedidos. Revisa rowIndex1Based y pedidoKey.",
          debug,
        },
        { status: 400 }
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });

    // ✅ Movimientos: usar inventarioId seleccionado
    const ts = new Date().toISOString();
    const movRowsToAppend: any[][] = [];

    for (const it of items) {
      const qty = Math.max(0, Number(it.cantidadReservarUnd || 0));
      if (qty <= 0) continue;

      const inventarioId = toStr(it.inventarioId || "");
      if (!inventarioId) continue; // si no seleccionó inventario, no reservamos

      movRowsToAppend.push([
        "", // movimientoId
        inventarioId,
        "Reserva",
        -qty, // negativa
        0,
        "", // almacenOrigen
        "", // almacenDestino
        pedidoKey,
        "PLN",
        "Reserva por planeación",
        ts,
        usuario,
      ]);
    }

    if (movRowsToAppend.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: "MovimientosInventario!A:L",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: movRowsToAppend },
      });
    }

    return NextResponse.json({
      success: true,
      updatedRows: data.length,
      reservasCreadas: movRowsToAppend.length,
      debug,
    });
  } catch (error) {
    console.error("[planeacion/pedido/guardar]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error guardando planeación",
      },
      { status: 500 }
    );
  }
}

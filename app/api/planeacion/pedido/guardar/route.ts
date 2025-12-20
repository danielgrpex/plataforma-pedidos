// app/api/planeacion/pedido/guardar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

type Body = {
  pedidoKey: string;
  observacionesPlaneacion: string;
  usuario: string;
  items: Array<{
    rowIndex1Based: number; // fila REAL en Sheets
    productoKey: string;
    destino: "Almacén" | "Corte" | "Producción";
    cantidadReservarUnd: number; // >=0
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

    const usuario = toStr(body.usuario) || "planeacion";
    const observacionesPlaneacion = toStr(body.observacionesPlaneacion || "");
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "items requeridos" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();
    const fecha = new Date().toISOString();

    // =============================
    // 1) ACTUALIZAR PEDIDOS (por fila)
    // =============================
    // En tu hoja:
    // S = Clasificación Planeación
    // T = Observaciones Planeación
    // U = Revisado Planeación
    // V = Fecha Revisión Planeación
    // W = Estado Planeación
    //
    // pedidoKey está en AL (col 38) => para validar fila: Pedidos!AL{row}
    const debug: Array<{
      row: number;
      ok: boolean;
      reason?: string;
      pedidoKeyInSheet?: string;
      destino?: string;
    }> = [];

    let updatedRows = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      const destino = toStr(it.destino) as "Almacén" | "Corte" | "Producción";

      if (!row || row < 2) {
        debug.push({ row, ok: false, destino, reason: "rowIndex inválido" });
        continue;
      }

      // 1.1) Validar que esa fila realmente es del pedidoKey (leyendo AL{row})
      const keyResp = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: `Pedidos!AL${row}:AL${row}`,
        valueRenderOption: "UNFORMATTED_VALUE",
      });

      const keyVal = toStr(keyResp.data.values?.[0]?.[0] ?? "");
      if (!keyVal) {
        debug.push({
          row,
          ok: false,
          destino,
          pedidoKeyInSheet: keyVal,
          reason: "AL está vacío en esa fila (no hay pedidoKey)",
        });
        continue;
      }

      if (keyVal !== pedidoKey) {
        debug.push({
          row,
          ok: false,
          destino,
          pedidoKeyInSheet: keyVal,
          reason: "AL no coincide con pedidoKey enviado",
        });
        continue;
      }

      // 1.2) Si coincide -> escribir S:W en esa fila
      const upd = await sheets.spreadsheets.values.update({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: `Pedidos!S${row}:X${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            destino,                  // S Clasificación Planeación
            observacionesPlaneacion,  // T Observaciones Planeación
            "TRUE",                   // U Revisado
            fecha,                    // V Fecha revisión
            destino,
            destino                   // W Estado Planeación (queda igual al destino)
          ]],
        },
      });

      const updatedCells = Number((upd.data as any)?.updatedCells || 0);

      if (updatedCells > 0) {
        updatedRows++;
        debug.push({ row, ok: true, destino });
      } else {
        debug.push({ row, ok: false, destino, reason: "update devolvió 0 celdas actualizadas" });
      }
    }

    // =============================
    // 2) CREAR MOVIMIENTOS (Reserva)
    // =============================
    // Leer inventario para mapear productoKey -> inventarioId
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invRows = (invResp.data.values || []).slice(1);

    function findInventarioIdByProductoKey(pk: string) {
      const row = invRows.find((r) => toStr(r[3]) === pk); // D = productoKey (index 3)
      return row ? toStr(row[0]) : "";
    }

    const ts = new Date().toISOString();
    const movRowsToAppend: any[][] = [];

    for (const it of items) {
      const pk = toStr(it.productoKey);
      const qty = Math.max(0, Number(it.cantidadReservarUnd || 0));
      if (!pk || qty <= 0) continue;

      const inventarioId = findInventarioIdByProductoKey(pk);
      if (!inventarioId) continue;

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

    // 👇 si no actualizó filas, NO digas success silencioso
    if (updatedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No se actualizó ninguna fila en Pedidos. Revisa rowIndex1Based (fila real) y que Pedidos!AL{fila} tenga exactamente el pedidoKey.",
          updatedRows,
          reservasCreadas: movRowsToAppend.length,
          debug,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedRows,
      reservasCreadas: movRowsToAppend.length,
      debug, // 🔥 esto te va a decir EXACTAMENTE por qué no escribió una fila
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

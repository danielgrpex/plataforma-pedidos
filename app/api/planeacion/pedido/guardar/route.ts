// app/api/planeacion/pedido/guardar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type Destino = "Almacén" | "Corte" | "Producción";

type Body = {
  pedidoKey: string;
  observacionesPlaneacion?: string;
  usuario?: string;
  items: Array<{
    rowIndex1Based: number;
    productoKey?: string;
    destino: Destino;

    // ✅ fechas por item (solo se guardan en Pedidos)
    fechas?: {
      entregaAlmacen?: string; // yyyy-mm-dd
      despacho?: string; // yyyy-mm-dd
    };

    // ✅ reservas por lote (cada una crea movimiento independiente)
    reservas?: Array<{
      inventarioId: string;
      cantidadUnd: number;
    }>;
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
    const fechaRevision = new Date().toISOString();

    /* =========================================================
       1) VALIDAR pedidoKey por fila usando columna AL
       ========================================================= */
    const rows = items
      .map((it) => Number(it.rowIndex1Based || 0))
      .filter((r) => r >= 2);

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: "rowIndex1Based inválidos" },
        { status: 400 }
      );
    }

    const rangesAL = rows.map((r) => `Pedidos!AL${r}:AL${r}`);

    const keyResp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      ranges: rangesAL,
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

    /* =========================================================
       2) ACTUALIZAR PEDIDOS (por item)
          Columnas:
          S  Clasificación Planeación
          T  Observaciones Planeación
          U  Revisado Planeación
          V  Fecha Revisión Planeación
          W  Estado Planeación
          X  Estado
          Y  Fecha Estimada Entrega Almacén   ✅ (por item)
          AA Fecha Estimada Despacho          ✅ (por item)
       ========================================================= */

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
        debug.push({
          row,
          ok: false,
          reason: `AL no coincide (AL=${keyInSheet})`,
        });
        continue;
      }

      const destino = toStr(it.destino) as Destino;

      const entregaAlm = toStr(it.fechas?.entregaAlmacen || "");
      const despacho = toStr(it.fechas?.despacho || "");

      // ✅ actualizamos en varios rangos para saltar Z (Fecha Real Entrega Almacén) si existe
      data.push({
        range: `Pedidos!S${row}:X${row}`,
        values: [[destino, observacionesPlaneacion, "TRUE", fechaRevision, destino, destino]],
      });

      // Y = Fecha Estimada Entrega Almacén
      data.push({
        range: `Pedidos!Y${row}:Y${row}`,
        values: [[entregaAlm]],
      });

      // AA = Fecha Estimada Despacho
      data.push({
        range: `Pedidos!AA${row}:AA${row}`,
        values: [[despacho]],
      });

      debug.push({ row, ok: true });
    }

    if (!data.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No se actualizó ninguna fila en Pedidos. Revisa rowIndex1Based y pedidoKey (col AL).",
          debug,
        },
        { status: 400 }
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });

    /* =========================================================
       3) CREAR MOVIMIENTOS (1 por cada reserva por lote)
          - Solo si destino != Producción
          - Solo qty > 0
          - referenciaOperacion: PLN-R{row}-{n}
       ========================================================= */

    const ts = new Date().toISOString();
    const movRowsToAppend: any[][] = [];
    let movCount = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) continue;

      const destino = toStr(it.destino) as Destino;
      if (destino === "Producción") continue; // ✅ Producción no mueve inventario

      const reservas = Array.isArray(it.reservas) ? it.reservas : [];
      if (!reservas.length) continue;

      let n = 0;
      for (const r of reservas) {
        const inventarioId = toStr(r?.inventarioId || "");
        const qty = Math.max(0, toNum(r?.cantidadUnd || 0));
        if (!inventarioId) continue;
        if (qty <= 0) continue;

        n += 1;
        movCount += 1;

        movRowsToAppend.push([
          "", // movimientoId
          inventarioId,
          "Reserva",
          -qty, // ✅ negativo
          0,
          "",
          "",
          pedidoKey,
          `PLN-R${row}-${n}`, // ✅ único por fila y por “lote”
          `Reserva por planeación (row ${row}) destino ${destino}`,
          ts,
          usuario,
        ]);
      }
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
      updatedRanges: data.length,
      movimientosCreados: movCount,
      debug,
    });
  } catch (error) {
    console.error("[planeacion/pedido/guardar]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error guardando planeación",
      },
      { status: 500 }
    );
  }
}

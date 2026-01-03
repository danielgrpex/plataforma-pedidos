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

function toInt(v: unknown) {
  return Math.max(0, Math.floor(toNum(v)));
}

// ID simple sin depender de libs (suficiente para Sheets)
function makeId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
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
    const ts = new Date().toISOString();

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
       1.1) LEER FILAS DE PEDIDOS (para cantidades / productoKey real)
       - Usamos A:AM para tener todo lo necesario
       ========================================================= */
    const rangesRows = rows.map((r) => `Pedidos!A${r}:AM${r}`);

    const rowsResp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      ranges: rangesRows,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const pedidoRowByIndex: Record<number, any[]> = {};
    (rowsResp.data.valueRanges || []).forEach((vr: any) => {
      const range: string = vr.range || "";
      const m = range.match(/Pedidos!A(\d+):/);
      const row = m ? Number(m[1]) : 0;
      const arr = (vr.values?.[0] as any[]) || [];
      if (row) pedidoRowByIndex[row] = arr;
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

      data.push({
        range: `Pedidos!S${row}:X${row}`,
        values: [[destino, observacionesPlaneacion, "TRUE", fechaRevision, destino, destino]],
      });

      data.push({
        range: `Pedidos!Y${row}:Y${row}`,
        values: [[entregaAlm]],
      });

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
    const movRowsToAppend: any[][] = [];
    let movCount = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) continue;

      const destino = toStr(it.destino) as Destino;
      if (destino === "Producción") continue;

      const reservas = Array.isArray(it.reservas) ? it.reservas : [];
      if (!reservas.length) continue;

      let n = 0;
      for (const r of reservas) {
        const inventarioId = toStr(r?.inventarioId || "");
        const qty = toInt(r?.cantidadUnd || 0);
        if (!inventarioId) continue;
        if (qty <= 0) continue;

        n += 1;
        movCount += 1;

        movRowsToAppend.push([
          "", // movimientoId
          inventarioId,
          "Reserva",
          -qty, // negativo
          0,
          "",
          "",
          pedidoKey,
          `PLN-R${row}-${n}`,
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

    /* =========================================================
       4) CREAR / ACTUALIZAR SOLICITUDES DE PRODUCCIÓN
          Hoja: SolicitudesProduccion
          Columnas:
          A solicitudProdId
          B pedidoKey
          C rowIndexPedido
          D productoKey
          E cantidadUND
          F estado
          G fechaCreacion
          H fechaUltActualizacion
          I usuario
          J OPE
       ========================================================= */

    // Leer solicitudes existentes para upsert por (pedidoKey + rowIndexPedido)
    const solResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:J",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const solValues = (solResp.data.values || []) as any[][];
    const solRows = solValues.length > 1 ? solValues.slice(1) : [];

    const solMap = new Map<
      string,
      { solicitudProdId: string; sheetRow: number; estado: string; ope: string }
    >();

    solRows.forEach((r, i) => {
      const solId = toStr(r[0]); // A
      const pk = toStr(r[1]); // B
      const rowIdx = toStr(r[2]); // C
      const estado = toStr(r[5]); // F
      const ope = toStr(r[9]); // J
      if (!solId || !pk || !rowIdx) return;
      solMap.set(`${pk}|${rowIdx}`, {
        solicitudProdId: solId,
        sheetRow: i + 2,
        estado,
        ope,
      });
    });

    const solAppend: any[][] = [];
    const solUpdateData: Array<{ range: string; values: any[][] }> = [];
    let solicitudesCreadas = 0;
    let solicitudesActualizadas = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) continue;

      const keyInSheet = keyMap[row] || "";
      if (keyInSheet !== pedidoKey) continue;

      const destino = toStr(it.destino) as Destino;
      if (destino !== "Producción") continue;

      const pedidoRow = pedidoRowByIndex[row] || [];

      // En Pedidos, cantidad UND está en col 12 (0-based 11) según tu implementación
      const solicitadoUnd = toInt(pedidoRow[11] ?? 0);

      // reservas del payload (aunque producción NO hace movimientos, el front igual puede enviar reservas=[])
      const reservas = Array.isArray(it.reservas) ? it.reservas : [];
      const reservadoUnd = reservas.reduce((acc, r) => acc + toInt(r?.cantidadUnd ?? 0), 0);

      // Lo que va a producción = solicitado - reservado
      const producirUnd = Math.max(0, solicitadoUnd - reservadoUnd);
      if (producirUnd <= 0) continue;

      // productoKey: usa el del payload si viene, si no el de Pedidos col 7 (0-based 6)
      const productoKey = toStr(it.productoKey) || toStr(pedidoRow[6] ?? "");

      const upKey = `${pedidoKey}|${row}`;
      const existing = solMap.get(upKey);

      if (!existing) {
        const solId = makeId("SOLPROD");
        solAppend.push([
          solId, // A
          pedidoKey, // B
          String(row), // C
          productoKey, // D
          String(producirUnd), // E
          "Pendiente", // F
          ts, // G
          ts, // H
          usuario, // I
          "", // J OPE
        ]);
        solicitudesCreadas += 1;
      } else {
        const sheetRow = existing.sheetRow;

        // Si ya tiene OPE, NO lo tocamos (para no dañar una orden ya programada)
        const hasOPE = Boolean(toStr(existing.ope));

        // E cantidadUND
        solUpdateData.push({
          range: `SolicitudesProduccion!E${sheetRow}:E${sheetRow}`,
          values: [[String(producirUnd)]],
        });

        // F estado: si NO tiene OPE => Pendiente, si tiene OPE => se respeta el estado actual
        solUpdateData.push({
          range: `SolicitudesProduccion!F${sheetRow}:F${sheetRow}`,
          values: [[hasOPE ? (toStr(existing.estado) || "Programado") : "Pendiente"]],
        });

        // H fechaUltActualizacion
        solUpdateData.push({
          range: `SolicitudesProduccion!H${sheetRow}:H${sheetRow}`,
          values: [[ts]],
        });

        // I usuario
        solUpdateData.push({
          range: `SolicitudesProduccion!I${sheetRow}:I${sheetRow}`,
          values: [[usuario]],
        });

        solicitudesActualizadas += 1;
      }
    }

    if (solAppend.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: "SolicitudesProduccion!A:J",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: solAppend },
      });
    }

    if (solUpdateData.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data: solUpdateData },
      });
    }

    return NextResponse.json({
      success: true,
      updatedRanges: data.length,
      movimientosCreados: movCount,
      solicitudesProduccion: {
        creadas: solicitudesCreadas,
        actualizadas: solicitudesActualizadas,
      },
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

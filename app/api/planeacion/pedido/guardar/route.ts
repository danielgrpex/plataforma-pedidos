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

// ===== Helpers para mapear columnas por header (Inventario) =====
function normKey(s: unknown) {
  return toStr(s).toLowerCase().replace(/\s+/g, "");
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const k = normKey(h);
    if (k) idx.set(k, i);
  });
  return idx;
}

function pickCell(row: any[], idx: Map<string, number>, ...possibleKeys: string[]) {
  for (const k of possibleKeys) {
    const i = idx.get(normKey(k));
    if (i !== undefined) return row[i];
  }
  return "";
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
      return NextResponse.json({ success: false, message: "pedidoKey requerido" }, { status: 400 });
    }

    const observacionesPlaneacion = toStr(body.observacionesPlaneacion);
    const usuario = toStr(body.usuario) || "planeacion";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ success: false, message: "items requeridos" }, { status: 400 });
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
      return NextResponse.json({ success: false, message: "rowIndex1Based inválidos" }, { status: 400 });
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
       1.1) LEER FILAS DE PEDIDOS (para cantidad UND / productoKey real)
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
        debug.push({ row, ok: false, reason: `AL no coincide (AL=${keyInSheet})` });
        continue;
      }

      const destino = toStr(it.destino) as Destino;
      const entregaAlm = toStr(it.fechas?.entregaAlmacen || "");
      const despacho = toStr(it.fechas?.despacho || "");

      data.push({
        range: `Pedidos!S${row}:X${row}`,
        values: [[destino, observacionesPlaneacion, "TRUE", fechaRevision, destino, destino]],
      });

      data.push({ range: `Pedidos!Y${row}:Y${row}`, values: [[entregaAlm]] });
      data.push({ range: `Pedidos!AA${row}:AA${row}`, values: [[despacho]] });

      debug.push({ row, ok: true });
    }

    if (!data.length) {
      return NextResponse.json(
        {
          success: false,
          message: "No se actualizó ninguna fila en Pedidos. Revisa rowIndex1Based y pedidoKey (col AL).",
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
       4) CREAR / ACTUALIZAR SOLICITUDES DE PRODUCCIÓN (si destino=Producción)
          Hoja: SolicitudesProduccion (A:J)
          Upsert por (pedidoKey + rowIndexPedido)
          - Si ya tiene OPE, NO tocamos OPE ni bajamos a Pendiente.
       ========================================================= */
    const solResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:J",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const solValues = (solResp.data.values || []) as any[][];
    const solRows = solValues.length > 1 ? solValues.slice(1) : [];

    const solMap = new Map<string, { sheetRow: number; estado: string; ope: string }>();
    solRows.forEach((r, i) => {
      const pk = toStr(r[1]); // B
      const rowIdx = toStr(r[2]); // C
      const estado = toStr(r[5]); // F
      const ope = toStr(r[9]); // J
      if (!pk || !rowIdx) return;
      solMap.set(`${pk}|${rowIdx}`, { sheetRow: i + 2, estado, ope });
    });

    const solAppend: any[][] = [];
    const solUpdateData: Array<{ range: string; values: any[][] }> = [];
    let solicitudesProdCreadas = 0;
    let solicitudesProdActualizadas = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) continue;

      const keyInSheet = keyMap[row] || "";
      if (keyInSheet !== pedidoKey) continue;

      const destino = toStr(it.destino) as Destino;
      if (destino !== "Producción") continue;

      const pedidoRow = pedidoRowByIndex[row] || [];

      // Pedidos: cantidad UND col 12 => index 11
      const solicitadoUnd = toInt(pedidoRow[11] ?? 0);

      // Reservas (pueden existir)
      const reservas = Array.isArray(it.reservas) ? it.reservas : [];
      const reservadoUnd = reservas.reduce((acc, r) => acc + toInt(r?.cantidadUnd ?? 0), 0);

      const producirUnd = Math.max(0, solicitadoUnd - reservadoUnd);
      if (producirUnd <= 0) continue;

      // productoKey: payload o Pedidos col 7 => index 6
      const productoKey = toStr(it.productoKey) || toStr(pedidoRow[6] ?? "");

      const upKey = `${pedidoKey}|${row}`;
      const existing = solMap.get(upKey);

      if (!existing) {
        const solId = makeId("SOLPROD");
        solAppend.push([solId, pedidoKey, String(row), productoKey, String(producirUnd), "Pendiente", ts, ts, usuario, ""]);
        solicitudesProdCreadas += 1;
      } else {
        const sheetRow = existing.sheetRow;
        const hasOPE = Boolean(toStr(existing.ope));

        solUpdateData.push(
          { range: `SolicitudesProduccion!E${sheetRow}:E${sheetRow}`, values: [[String(producirUnd)]] },
          {
            range: `SolicitudesProduccion!F${sheetRow}:F${sheetRow}`,
            values: [[hasOPE ? (toStr(existing.estado) || "Programado") : "Pendiente"]],
          },
          { range: `SolicitudesProduccion!H${sheetRow}:H${sheetRow}`, values: [[ts]] },
          { range: `SolicitudesProduccion!I${sheetRow}:I${sheetRow}`, values: [[usuario]] }
        );

        solicitudesProdActualizadas += 1;
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

    /* =========================================================
       4.5) INVENTARIO MAP (para llenar productoOrigen y largoOrigen en corte)
       ========================================================= */
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invValues = (invResp.data.values || []) as any[][];
    const invHeader = invValues[0] || [];
    const invBody = invValues.length > 1 ? invValues.slice(1) : [];

    const invIdx = buildHeaderIndex(invHeader);

    const invMap = new Map<string, { productoOrigen: string; largoOrigen: string }>();

    for (const r of invBody) {
      const inventarioId = toStr(
        pickCell(r, invIdx, "inventarioid", "inventarioorigenid", "id", "idinventario")
      );
      if (!inventarioId) continue;

      const productoOrigen = toStr(
        pickCell(r, invIdx, "productoorigen", "producto", "productokey", "productotexto", "descripcion", "referencia")
      );

      const largoOrigen = toStr(
        pickCell(r, invIdx, "largo", "largo(origen)", "largo_cm", "largocm", "largo_m", "largom", "longitud")
      );

      invMap.set(inventarioId, { productoOrigen, largoOrigen });
    }

    /* =========================================================
       5) CREAR / ACTUALIZAR SOLICITUDES DE CORTE (si destino=Corte)
          Hoja: SolicitudesCorte (A:P)
          Upsert por (pedidoKey + rowIndexPedido)
          - Si ya tiene OTE, NO lo tocamos.
       ========================================================= */
    const corteResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesCorte!A:P",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const corteValues = (corteResp.data.values || []) as any[][];
    const corteRows = corteValues.length > 1 ? corteValues.slice(1) : [];

    const corteMap = new Map<string, { sheetRow: number; estadoitem: string; ote: string }>();

    corteRows.forEach((r, i) => {
      const pk = toStr(r[1]); // B pedidoKey
      const rowIdx = toStr(r[2]); // C rowIndexPedido
      const estadoitem = toStr(r[12]); // M estadoitem
      const ote = toStr(r[15]); // P OTE
      if (!pk || !rowIdx) return;
      corteMap.set(`${pk}|${rowIdx}`, { sheetRow: i + 2, estadoitem, ote });
    });

    const corteAppend: any[][] = [];
    const corteUpdateData: Array<{ range: string; values: any[][] }> = [];
    let solicitudesCorteCreadas = 0;
    let solicitudesCorteActualizadas = 0;

    for (const it of items) {
      const row = Number(it.rowIndex1Based || 0);
      if (!row || row < 2) continue;

      const keyInSheet = keyMap[row] || "";
      if (keyInSheet !== pedidoKey) continue;

      const destino = toStr(it.destino) as Destino;
      if (destino !== "Corte") continue;

      const pedidoRow = pedidoRowByIndex[row] || [];

      // productoSolicitado: payload o Pedidos col 7 => index 6
      const productoSolicitado = toStr(it.productoKey) || toStr(pedidoRow[6] ?? "");

      // cantidadSolicitadaUnd: Pedidos col 12 => index 11
      const cantidadSolicitadaUnd = toInt(pedidoRow[11] ?? 0);

      // Primer lote reservado como "origen" (por ahora)
      const reservas = Array.isArray(it.reservas) ? it.reservas : [];
      const inventarioOrigenId = toStr(reservas?.[0]?.inventarioId || "");
      const cantidadOrigenUnd = toInt(reservas?.[0]?.cantidadUnd || 0);

      // lookup inventario
      const invInfo = inventarioOrigenId ? invMap.get(inventarioOrigenId) : undefined;
      const productoOrigen = toStr(invInfo?.productoOrigen || "");
      const largoOrigen = toStr(invInfo?.largoOrigen || "");

      const upKey = `${pedidoKey}|${row}`;
      const existing = corteMap.get(upKey);

      if (!existing) {
        corteAppend.push([
          makeId("SOLCOR"), // A solicitudCorteId
          pedidoKey, // B pedidoKey
          String(row), // C rowIndexPedido
          productoSolicitado, // D productoSolicitado
          String(cantidadSolicitadaUnd), // E cantidadSolicitadaUnd
          inventarioOrigenId, // F inventarioOrigenId
          productoOrigen, // G productoOrigen ✅
          largoOrigen, // H largoOrigen ✅
          String(cantidadOrigenUnd || ""), // I cantidadOrigenUnd
          "", // J largoFinal
          "", // K actividades
          "", // L cantidadResultanteUnd
          "Pendiente", // M estadoitem
          ts, // N fechaCreacion
          usuario, // O usuario
          "", // P OTE
        ]);

        solicitudesCorteCreadas += 1;
      } else {
        const sheetRow = existing.sheetRow;
        const hasOTE = Boolean(toStr(existing.ote));
        if (hasOTE) continue;

        corteUpdateData.push(
          { range: `SolicitudesCorte!D${sheetRow}:D${sheetRow}`, values: [[productoSolicitado]] },
          { range: `SolicitudesCorte!E${sheetRow}:E${sheetRow}`, values: [[String(cantidadSolicitadaUnd)]] },
          { range: `SolicitudesCorte!F${sheetRow}:F${sheetRow}`, values: [[inventarioOrigenId]] },
          { range: `SolicitudesCorte!G${sheetRow}:G${sheetRow}`, values: [[productoOrigen]] }, // ✅
          { range: `SolicitudesCorte!H${sheetRow}:H${sheetRow}`, values: [[largoOrigen]] }, // ✅
          { range: `SolicitudesCorte!I${sheetRow}:I${sheetRow}`, values: [[String(cantidadOrigenUnd || "")]] },
          { range: `SolicitudesCorte!M${sheetRow}:M${sheetRow}`, values: [["Pendiente"]] },
          { range: `SolicitudesCorte!O${sheetRow}:O${sheetRow}`, values: [[usuario]] }
        );

        solicitudesCorteActualizadas += 1;
      }
    }

    if (corteAppend.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: "SolicitudesCorte!A:P",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: corteAppend },
      });
    }

    if (corteUpdateData.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data: corteUpdateData },
      });
    }

    return NextResponse.json({
      success: true,
      updatedRanges: data.length,
      movimientosCreados: movCount,
      solicitudesProduccion: {
        creadas: solicitudesProdCreadas,
        actualizadas: solicitudesProdActualizadas,
      },
      solicitudesCorte: {
        creadas: solicitudesCorteCreadas,
        actualizadas: solicitudesCorteActualizadas,
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

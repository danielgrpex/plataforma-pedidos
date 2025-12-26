import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_ITEMS = "ordenCorteItems";
const SHEET_MOV = "MovimientosInventario";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function getSheets() {
  const email = mustEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = mustEnv(process.env.GOOGLE_PRIVATE_KEY, "GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function readSheetAll(sheets: any, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const values: any[][] = res.data.values || [];
  if (values.length === 0) return { headers: [] as string[], rows: [] as any[][] };

  const headers = (values[0] || []).map((h) => String(h || "").trim());
  const rows = values.slice(1);
  return { headers, rows };
}

function headerMap(headers: string[]) {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(String(h || "").trim(), i));
  return m;
}

function findCol(headers: string[], candidates: string[]) {
  const hm = headerMap(headers);

  // 1) match exacto
  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  // 2) match por includes
  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const ci = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (ci >= 0) return ci;
  }

  return -1;
}

// Heurísticas de columnas
const COL_ITEMS = {
  ordenCorteItemId: ["ordenCorteItemId", "OrdenCorteItemId", "ordenCorteItemid"],
  ordenCorteId: ["ordenCorteId", "OrdenCorteId"],
  pedidoKey: ["pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  productoSolicitado: ["productoSolicitado", "ProductoSolicitado", "productoKey", "ProductoKey"],
  cantidadSolicitadaUnd: ["cantidadSolicitadaUnd", "CantidadSolicitadaUnd", "solicitado", "Solicitado"],
  cantidadEntregadaUnd: [
    "cantidadEntregadaUnd",
    "CantidadEntregadaUnd",
    "entregado",
    "Entregado",
    "entregadoAcumulado",
  ],
  estadoItem: ["estadoItem", "EstadoItem", "estado", "Estado"],
  destinoFinal: ["destinoFinal", "DestinoFinal"],
};

const COL_MOV = {
  tipoMovimiento: ["tipoMovimiento", "TipoMovimiento", "movimiento", "Movimiento", "tipo"],
  cantidadUnd: ["cantidadUnd", "CantidadUnd", "cantidad", "Cantidad", "cantidadEntregadaUnd"],
  referenciaOperacion: ["referenciaOperacion", "ReferenciaOperacion", "referencia", "Referencia"],
};

type OrdenItem = {
  ordenCorteItemId: string;
  ordenCorteId: string;
  pedidoKey?: string;
  pedidoRowIndex?: number;
  productoSolicitado?: string;

  cantidadSolicitadaUnd: number;
  cantidadEntregadaUnd: number; // calculada desde MovimientosInventario (source of truth)
  pendienteUnd: number;

  estadoItem?: string;
  destinoFinal?: string;

  progresoPct: number;
};

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const sheets = await getSheets();

    // 1) Leer MovimientosInventario y construir SUM por referenciaOperacion (ordenCorteItemId)
    const { headers: movHeaders, rows: movRows } = await readSheetAll(sheets, SHEET_MOV);
    const idxMovTipo = movHeaders.length ? findCol(movHeaders, COL_MOV.tipoMovimiento) : -1;
    const idxMovCant = movHeaders.length ? findCol(movHeaders, COL_MOV.cantidadUnd) : -1;
    const idxMovRef = movHeaders.length ? findCol(movHeaders, COL_MOV.referenciaOperacion) : -1;

    const entregadoPorItem = new Map<string, number>();

    if (movHeaders.length > 0 && idxMovCant >= 0 && idxMovRef >= 0) {
      for (const r of movRows) {
        const ref = String(r[idxMovRef] || "").trim();
        if (!ref) continue;

        const tipo = idxMovTipo >= 0 ? String(r[idxMovTipo] || "").trim() : "";
        // Solo sumar entregas a almacén (tolerante a variantes)
        const esEntrega =
          !tipo ||
          tipo.toLowerCase().includes("entrega a almac") ||
          tipo.toLowerCase() === "entrega a almacén" ||
          tipo.toLowerCase() === "entrega a almacen";

        if (!esEntrega) continue;

        const cant = safeNum(r[idxMovCant]);
        if (cant <= 0) continue;

        entregadoPorItem.set(ref, (entregadoPorItem.get(ref) || 0) + cant);
      }
    }

    // 2) Leer ordenCorteItems y armar lista completa
    const { headers, rows } = await readSheetAll(sheets, SHEET_ITEMS);
    if (headers.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_ITEMS} no tiene headers` },
        { status: 500 }
      );
    }

    const idxItemId = findCol(headers, COL_ITEMS.ordenCorteItemId);
    const idxOcId = findCol(headers, COL_ITEMS.ordenCorteId);
    const idxPedidoKey = findCol(headers, COL_ITEMS.pedidoKey);
    const idxPedidoRow = findCol(headers, COL_ITEMS.pedidoRowIndex);
    const idxProdSol = findCol(headers, COL_ITEMS.productoSolicitado);
    const idxSolicitado = findCol(headers, COL_ITEMS.cantidadSolicitadaUnd);
    const idxEntregadoSheet = findCol(headers, COL_ITEMS.cantidadEntregadaUnd);
    const idxEstado = findCol(headers, COL_ITEMS.estadoItem);
    const idxDestino = findCol(headers, COL_ITEMS.destinoFinal);

    if (idxItemId < 0 || idxOcId < 0 || idxSolicitado < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            `No pude mapear columnas mínimas en ${SHEET_ITEMS}. ` +
            `Requiere: ordenCorteItemId, ordenCorteId, cantidadSolicitadaUnd.`,
        },
        { status: 500 }
      );
    }

    const items: OrdenItem[] = [];

    for (const r of rows) {
      const ordenCorteItemId = String(r[idxItemId] || "").trim();
      const ordenCorteId = String(r[idxOcId] || "").trim();
      if (!ordenCorteItemId || !ordenCorteId) continue;

      const solicitado = safeNum(r[idxSolicitado]);
      const entregadoMov = entregadoPorItem.get(ordenCorteItemId) || 0;
      const entregadoSheet = idxEntregadoSheet >= 0 ? safeNum(r[idxEntregadoSheet]) : 0;

      // Source of truth: MovimientosInventario
      // Fallback robusto: si alguna vez hubo datos en la sheet, usa el mayor.
      const entregado = Math.max(entregadoMov, entregadoSheet);

      const pendiente = Math.max(0, solicitado - entregado);
      const progresoPct = solicitado > 0 ? Math.max(0, Math.min(100, (entregado / solicitado) * 100)) : 0;

      const estadoItem = idxEstado >= 0 ? String(r[idxEstado] || "").trim() : "";
      const destinoFinal = idxDestino >= 0 ? String(r[idxDestino] || "").trim() : "";

      const pedidoKey = idxPedidoKey >= 0 ? String(r[idxPedidoKey] || "").trim() : "";
      const pedidoRowIndex = idxPedidoRow >= 0 ? safeNum(r[idxPedidoRow]) : undefined;
      const productoSolicitado = idxProdSol >= 0 ? String(r[idxProdSol] || "").trim() : "";

      items.push({
        ordenCorteItemId,
        ordenCorteId,
        pedidoKey: pedidoKey || undefined,
        pedidoRowIndex: pedidoRowIndex !== undefined ? Number(pedidoRowIndex) : undefined,
        productoSolicitado: productoSolicitado || undefined,
        cantidadSolicitadaUnd: solicitado,
        cantidadEntregadaUnd: entregado,
        pendienteUnd: pendiente,
        estadoItem: estadoItem || undefined,
        destinoFinal: destinoFinal || undefined,
        progresoPct: Number(progresoPct.toFixed(2)),
      });
    }

    // Orden bonito
    items.sort((a, b) => {
      if (a.ordenCorteId !== b.ordenCorteId) return a.ordenCorteId.localeCompare(b.ordenCorteId);
      return a.ordenCorteItemId.localeCompare(b.ordenCorteItemId);
    });

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en /ordenes-items" },
      { status: 500 }
    );
  }
}

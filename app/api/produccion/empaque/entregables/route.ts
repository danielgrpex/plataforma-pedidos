// app/api/produccion/empaque/entregables/route.ts
// app/api/produccion/empaque/entregables/route.ts
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

// Heurísticas: nombres posibles por columna
const COL_ITEMS = {
  ordenCorteItemId: ["ordenCorteItemId", "OrdenCorteItemId", "ordenCorteItemid"],
  ordenCorteId: ["ordenCorteId", "OrdenCorteId"],
  pedidoKey: ["pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  productoSolicitado: ["productoSolicitado", "ProductoSolicitado", "productoKey", "ProductoKey"],
  cantidadSolicitadaUnd: ["cantidadSolicitadaUnd", "CantidadSolicitadaUnd", "solicitado", "Solicitado"],
  estadoItem: ["estadoItem", "EstadoItem", "estado", "Estado"],
  destinoFinal: ["destinoFinal", "DestinoFinal"],
};

const COL_MOV = {
  tipoMovimiento: ["tipoMovimiento", "TipoMovimiento", "tipo", "Tipo", "movimiento", "Movimiento"],
  cantidadUnd: ["cantidadUnd", "CantidadUnd", "cantidad", "Cantidad", "cantidadEntregadaUnd"],
  referenciaOperacion: ["referenciaOperacion", "ReferenciaOperacion", "referencia", "Referencia"],
};

type Entregable = {
  ordenCorteItemId: string;
  ordenCorteId: string;
  pedidoKey?: string;
  pedidoRowIndex?: number;
  productoSolicitado?: string; // productoKey solicitado (lo que pide el pedido)
  cantidadSolicitadaUnd: number;

  // AHORA: calculado desde MovimientosInventario (verdad operativa)
  cantidadEntregadaUnd: number;
  pendienteUnd: number;

  estadoItem?: string;
  destinoFinal?: string;
};

function isAlmacen(estado: string) {
  const s = String(estado || "").trim().toLowerCase();
  return s === "almacén" || s === "almacen";
}

function isEntregaMovimiento(tipo: string) {
  const t = String(tipo || "").trim().toLowerCase();
  // robusto: si contiene "entrega" lo tratamos como entrega (ej: "Entrega a almacén")
  return t.includes("entrega");
}

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    // =========================
    // 1) Leer ordenCorteItems
    // =========================
    const { headers: hItems, rows: rItems } = await readSheetAll(sheets, SHEET_ITEMS);
    if (hItems.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_ITEMS} no tiene headers` },
        { status: 500 }
      );
    }

    const idxItemId = findCol(hItems, COL_ITEMS.ordenCorteItemId);
    const idxOcId = findCol(hItems, COL_ITEMS.ordenCorteId);
    const idxPedidoKey = findCol(hItems, COL_ITEMS.pedidoKey);
    const idxPedidoRow = findCol(hItems, COL_ITEMS.pedidoRowIndex);
    const idxProdSol = findCol(hItems, COL_ITEMS.productoSolicitado);
    const idxSolicitado = findCol(hItems, COL_ITEMS.cantidadSolicitadaUnd);
    const idxEstado = findCol(hItems, COL_ITEMS.estadoItem);
    const idxDestino = findCol(hItems, COL_ITEMS.destinoFinal);

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

    // =========================
    // 2) Leer MovimientosInventario y armar acumulado por ordenCorteItemId
    //    (OPCIÓN A: la verdad operativa)
    // =========================
    const { headers: hMov, rows: rMov } = await readSheetAll(sheets, SHEET_MOV);
    if (hMov.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_MOV} no tiene headers` },
        { status: 500 }
      );
    }

    const idxMovTipo = findCol(hMov, COL_MOV.tipoMovimiento);
    const idxMovCant = findCol(hMov, COL_MOV.cantidadUnd);
    const idxMovRef = findCol(hMov, COL_MOV.referenciaOperacion);

    if (idxMovTipo < 0 || idxMovCant < 0 || idxMovRef < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            `No pude mapear columnas mínimas en ${SHEET_MOV}. ` +
            `Requiere: tipoMovimiento, cantidadUnd, referenciaOperacion.`,
        },
        { status: 500 }
      );
    }

    // Mapa: "OC-2025-00037 - 52" -> total entregado UND
    const entregadoMap = new Map<string, number>();

    for (const r of rMov) {
      const tipo = String(r[idxMovTipo] || "").trim();
      if (!isEntregaMovimiento(tipo)) continue;

      const ref = String(r[idxMovRef] || "").trim();
      if (!ref) continue;

      const cant = safeNum(r[idxMovCant]);
      if (cant === 0) continue;

      entregadoMap.set(ref, (entregadoMap.get(ref) || 0) + cant);
    }

    // =========================
    // 3) Construir entregables (pendiente = solicitado - entregadoReal)
    // =========================
    const entregables: Entregable[] = [];

    for (const r of rItems) {
      const ordenCorteItemId = String(r[idxItemId] || "").trim();
      const ordenCorteId = String(r[idxOcId] || "").trim();
      if (!ordenCorteItemId || !ordenCorteId) continue;

      const solicitado = safeNum(r[idxSolicitado]);
      const entregadoReal = entregadoMap.get(ordenCorteItemId) || 0;

      const pendiente = Math.max(0, solicitado - entregadoReal);

      const estadoItem = idxEstado >= 0 ? String(r[idxEstado] || "").trim() : "";
      const destinoFinal = idxDestino >= 0 ? String(r[idxDestino] || "").trim() : "";

      // Regla de negocio:
      // - Desaparece si pendiente == 0 (ya quedó completo)
      // - O si el item ya está marcado como Almacén (independiente del acumulado)
      if (pendiente <= 0 || isAlmacen(estadoItem)) continue;

      const pedidoKey = idxPedidoKey >= 0 ? String(r[idxPedidoKey] || "").trim() : "";
      const pedidoRowIndex = idxPedidoRow >= 0 ? safeNum(r[idxPedidoRow]) : undefined;
      const productoSolicitado = idxProdSol >= 0 ? String(r[idxProdSol] || "").trim() : "";

      entregables.push({
        ordenCorteItemId,
        ordenCorteId,
        pedidoKey: pedidoKey || undefined,
        pedidoRowIndex: pedidoRowIndex !== undefined ? Number(pedidoRowIndex) : undefined,
        productoSolicitado: productoSolicitado || undefined,

        cantidadSolicitadaUnd: solicitado,
        cantidadEntregadaUnd: entregadoReal,
        pendienteUnd: pendiente,

        estadoItem: estadoItem || undefined,
        destinoFinal: destinoFinal || undefined,
      });
    }

    // Orden bonito
    entregables.sort((a, b) => {
      if (a.ordenCorteId !== b.ordenCorteId) return a.ordenCorteId.localeCompare(b.ordenCorteId);
      return a.ordenCorteItemId.localeCompare(b.ordenCorteItemId);
    });

    return NextResponse.json({
      success: true,
      count: entregables.length,
      items: entregables,
      debug: {
        sourceEntregado: "MovimientosInventario (tipoMovimiento contiene 'entrega')",
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en /entregables" },
      { status: 500 }
    );
  }
}

// app/api/logistica/despachar/route.ts
// app/api/logistica/despachar/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

type DespacharBody = {
  usuario: string;               // quien despacha (logística)
  pedidosKey: string;            // pedidosKey
  pedidoRowIndex: number;        // ✅ FILA REAL en Sheet Pedidos (1-based). NO es columna.
  cantidadDespachadaUnd: number; // parcial o total

  transporte?: string;
  guia?: string;
  factura?: string;
  remision?: string;
  observaciones?: string;
};

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;

const SHEET_PEDIDOS = "Pedidos";
const SHEET_DESPACHOS = "Despachos";
const SHEET_MOV = "MovimientosInventario";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
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

  // match exacto
  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  // match contains
  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const ci = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (ci >= 0) return ci;
  }
  return -1;
}

function pickHeader(headers: string[], candidates: string[]) {
  const hm = headerMap(headers);
  for (const c of candidates) if (hm.has(c)) return c;

  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (i >= 0) return headers[i];
  }
  return null;
}

function buildRow(headers: string[], valuesByHeader: Record<string, any>) {
  const row = Array(headers.length).fill("");
  const hm = headerMap(headers);
  for (const [k, v] of Object.entries(valuesByHeader)) {
    const idx = hm.get(k);
    if (idx !== undefined) row[idx] = v ?? "";
  }
  return row;
}

async function appendRow(sheets: any, sheetName: string, row: any[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

async function updateCells(
  sheets: any,
  sheetName: string,
  rowNumber1Based: number,
  updates: Array<{ colIndex0Based: number; value: any }>
) {
  const requests = updates.map((u) => {
    const colLetter = numToCol(u.colIndex0Based + 1);
    const a1 = `${sheetName}!${colLetter}${rowNumber1Based}`;
    return sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: a1,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[u.value ?? ""]] },
    });
  });
  await Promise.all(requests);
}

function numToCol(n1: number) {
  let n = n1;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** =========================
 * Column heuristics
 * ========================= */
const COL_PEDIDOS = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "Cantidad", "cantidadUnd", "cantidad (und)"],
  estado: ["Estado", "estado"],
  fechaRealDespacho: ["Fecha Real Despacho", "Fecha Real Despacho ", "fecha real despacho"],
  transporte: ["Transporte", "transporte"],
  guia: ["Guia", "Guía", "guia", "guía", "GUIA"],
  factura: ["Factura", "factura"],
  remision: ["Remision", "Remisión", "remision", "remisión", "REMISION"],
};

const COL_DESPACHOS = {
  despachoId: ["despachoId", "DespachoId", "id"],
  fecha: ["fechaDespacho", "FechaDespacho", "fechaMovimiento", "fechaMovimientoISO", "fecha", "Fecha"],
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  cantidadUnd: ["cantidadUnd", "cantidadDespachadaUnd", "CantidadUnd", "CantidadDespachadaUnd", "cantidad"],
  usuario: ["usuario", "Usuario"],
  transporte: ["transporte", "Transporte"],
  guia: ["guia", "Guia", "guía", "Guía"],
  factura: ["factura", "Factura"],
  remision: ["remision", "Remision", "remisión", "Remisión"],
  observaciones: ["observaciones", "Observaciones", "obs", "Obs"],
};

const COL_MOV = {
  movimientoId: ["movimientoId", "MovimientoId", "id", "ID"],
  inventarioId: ["inventarioId", "InventarioId"],
  tipoMovimiento: ["tipoMovimiento", "TipoMovimiento", "tipoMov", "tipoMovimiento "],
  cantidadUnd: ["cantidadUnd", "CantidadUnd", "cantidad", "Cantidad"],
  cantidadM: ["cantidadM", "CantidadM"],
  almacenOrigen: ["almacenOrigen", "AlmacenOrigen"],
  almacenDestino: ["almacenDestino", "AlmacenDestino"],
  pedidoKey: ["pedidoKey", "PedidoKey", "pedidosKey", "PedidosKey"],
  referenciaOperacion: ["referenciaOperacion", "ReferenciaOperacion"],
  motivo: ["motivo", "Motivo"],
  fechaMovimiento: ["fechaMovimiento", "FechaMovimiento", "fechaMovimientoISO", "FechaMovimientoISO"],
  usuario: ["usuario", "Usuario"],
};

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const body = (await req.json()) as Partial<DespacharBody>;

    const usuario = norm(body.usuario);
    const pedidosKey = norm(body.pedidosKey);
    const pedidoRowIndex = Math.floor(safeNum(body.pedidoRowIndex)); // ✅ fila real 1-based
    const cantidadDespachadaUnd = safeNum(body.cantidadDespachadaUnd);

    const transporte = norm(body.transporte);
    const guia = norm(body.guia);
    const factura = norm(body.factura);
    const remision = norm(body.remision);
    const observaciones = norm(body.observaciones);

    if (!usuario) return NextResponse.json({ success: false, message: "Falta usuario" }, { status: 400 });
    if (!pedidosKey) return NextResponse.json({ success: false, message: "Falta pedidosKey" }, { status: 400 });

    // ✅ fila real: mínimo 2 (porque fila 1 son headers)
    if (!pedidoRowIndex || pedidoRowIndex < 2) {
      return NextResponse.json({ success: false, message: "pedidoRowIndex inválido (debe ser fila real >= 2)" }, { status: 400 });
    }

    if (cantidadDespachadaUnd <= 0) {
      return NextResponse.json({ success: false, message: "cantidadDespachadaUnd debe ser > 0" }, { status: 400 });
    }

    // =========================
    // 1) Leer PEDIDOS y ubicar la fila exacta (por fila, no por columna)
    // =========================
    const { headers: pedHeaders, rows: pedRows } = await readSheetAll(sheets, SHEET_PEDIDOS);
    if (pedHeaders.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` }, { status: 500 });
    }

    const idxPk = findCol(pedHeaders, COL_PEDIDOS.pedidosKey);
    const idxCant = findCol(pedHeaders, COL_PEDIDOS.cantidadUnd);
    const idxEstado = findCol(pedHeaders, COL_PEDIDOS.estado);
    const idxFechaReal = findCol(pedHeaders, COL_PEDIDOS.fechaRealDespacho);
    const idxTransp = findCol(pedHeaders, COL_PEDIDOS.transporte);
    const idxGuia = findCol(pedHeaders, COL_PEDIDOS.guia);
    const idxFactura = findCol(pedHeaders, COL_PEDIDOS.factura);
    const idxRemision = findCol(pedHeaders, COL_PEDIDOS.remision);

    // ✅ OJO: NO existe "pedidoRowIndex" como columna
    if (idxPk < 0 || idxCant < 0 || idxEstado < 0) {
      return NextResponse.json(
        { success: false, message: `No pude mapear columnas mínimas en ${SHEET_PEDIDOS} (pedidosKey, Cantidad (und), Estado).` },
        { status: 500 }
      );
    }

    // pedidoRowIndex es 1-based en sheet, pedRows es 0-based sin headers:
    const pedRowIndex0 = pedidoRowIndex - 2;
    if (pedRowIndex0 < 0 || pedRowIndex0 >= pedRows.length) {
      return NextResponse.json(
        { success: false, message: `pedidoRowIndex fuera de rango en ${SHEET_PEDIDOS}: ${pedidoRowIndex}` },
        { status: 400 }
      );
    }

    const pedRow = pedRows[pedRowIndex0];

    // Validación de integridad: la fila debe corresponder al pedidosKey
    const pkEnFila = norm(pedRow[idxPk]);
    if (pkEnFila !== pedidosKey) {
      return NextResponse.json(
        {
          success: false,
          message: `La fila ${pedidoRowIndex} no corresponde al pedidosKey enviado. En fila=${pkEnFila}, enviado=${pedidosKey}`,
        },
        { status: 409 }
      );
    }

    const solicitadoUnd = safeNum(pedRow[idxCant]);
    if (solicitadoUnd <= 0) {
      return NextResponse.json(
        { success: false, message: `Cantidad solicitada inválida en Pedidos (fila ${pedidoRowIndex}).` },
        { status: 400 }
      );
    }

    // =========================
    // 2) Calcular YA despachado desde DESPACHOS (por pedidosKey + pedidoRowIndex)
    // =========================
    const { headers: desHeaders, rows: desRows } = await readSheetAll(sheets, SHEET_DESPACHOS);
    if (desHeaders.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_DESPACHOS} no tiene headers` }, { status: 500 });
    }

    const dPk = findCol(desHeaders, COL_DESPACHOS.pedidosKey);
    const dRow = findCol(desHeaders, COL_DESPACHOS.pedidoRowIndex);
    const dCant = findCol(desHeaders, COL_DESPACHOS.cantidadUnd);

    if (dPk < 0 || dRow < 0 || dCant < 0) {
      return NextResponse.json(
        { success: false, message: `No pude mapear columnas mínimas en ${SHEET_DESPACHOS} (pedidosKey, pedidoRowIndex, cantidad).` },
        { status: 500 }
      );
    }

    let yaDespachado = 0;
    for (const r of desRows) {
      const pk = norm(r[dPk]);
      const ri = Math.floor(safeNum(r[dRow]));
      if (pk === pedidosKey && ri === pedidoRowIndex) {
        yaDespachado += safeNum(r[dCant]);
      }
    }

    const nuevoTotal = yaDespachado + cantidadDespachadaUnd;
    if (nuevoTotal > solicitadoUnd) {
      return NextResponse.json(
        {
          success: false,
          message: `Despacho supera lo solicitado. Solicitado=${solicitadoUnd}, YaDespachado=${yaDespachado}, Intento=${cantidadDespachadaUnd}`,
        },
        { status: 400 }
      );
    }

    const completo = nuevoTotal >= solicitadoUnd;
    const pendiente = Math.max(0, solicitadoUnd - nuevoTotal);

    // =========================
    // 3) Append en DESPACHOS
    // =========================
    const despachoId = uid("DESP");
    const fechaISO = new Date().toISOString();

    const outDes: Record<string, any> = {};
    const hDesId = pickHeader(desHeaders, COL_DESPACHOS.despachoId);
    const hDesFecha = pickHeader(desHeaders, COL_DESPACHOS.fecha);
    const hDesPk = pickHeader(desHeaders, COL_DESPACHOS.pedidosKey);
    const hDesRow = pickHeader(desHeaders, COL_DESPACHOS.pedidoRowIndex);
    const hDesCant = pickHeader(desHeaders, COL_DESPACHOS.cantidadUnd);
    const hDesUser = pickHeader(desHeaders, COL_DESPACHOS.usuario);
    const hDesTrans = pickHeader(desHeaders, COL_DESPACHOS.transporte);
    const hDesGuia = pickHeader(desHeaders, COL_DESPACHOS.guia);
    const hDesFact = pickHeader(desHeaders, COL_DESPACHOS.factura);
    const hDesRem = pickHeader(desHeaders, COL_DESPACHOS.remision);
    const hDesObs = pickHeader(desHeaders, COL_DESPACHOS.observaciones);

    if (hDesId) outDes[hDesId] = despachoId;
    if (hDesFecha) outDes[hDesFecha] = fechaISO;
    if (hDesPk) outDes[hDesPk] = pedidosKey;
    if (hDesRow) outDes[hDesRow] = pedidoRowIndex;
    if (hDesCant) outDes[hDesCant] = cantidadDespachadaUnd;
    if (hDesUser) outDes[hDesUser] = usuario;
    if (hDesTrans && transporte) outDes[hDesTrans] = transporte;
    if (hDesGuia && guia) outDes[hDesGuia] = guia;
    if (hDesFact && factura) outDes[hDesFact] = factura;
    if (hDesRem && remision) outDes[hDesRem] = remision;
    if (hDesObs && observaciones) outDes[hDesObs] = observaciones;

    await appendRow(sheets, SHEET_DESPACHOS, buildRow(desHeaders, outDes));

    // =========================
    // 4) Append en MOVIMIENTOS (Salida por despacho)
    // =========================
    const { headers: movHeaders } = await readSheetAll(sheets, SHEET_MOV);
    if (movHeaders.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_MOV} no tiene headers` }, { status: 500 });
    }

    const movId = uid("MOV");
    const outMov: Record<string, any> = {};

    const hMovId = pickHeader(movHeaders, COL_MOV.movimientoId);
    const hInv = pickHeader(movHeaders, COL_MOV.inventarioId);
    const hTipo = pickHeader(movHeaders, COL_MOV.tipoMovimiento);
    const hCantU = pickHeader(movHeaders, COL_MOV.cantidadUnd);
    const hCantM = pickHeader(movHeaders, COL_MOV.cantidadM);
    const hAO = pickHeader(movHeaders, COL_MOV.almacenOrigen);
    const hAD = pickHeader(movHeaders, COL_MOV.almacenDestino);
    const hPed = pickHeader(movHeaders, COL_MOV.pedidoKey);
    const hRef = pickHeader(movHeaders, COL_MOV.referenciaOperacion);
    const hMot = pickHeader(movHeaders, COL_MOV.motivo);
    const hFecha = pickHeader(movHeaders, COL_MOV.fechaMovimiento);
    const hUser = pickHeader(movHeaders, COL_MOV.usuario);

    if (hMovId) outMov[hMovId] = movId;

    // 🔹 inventarioId: lo conectamos después (cuando amarre inventario a pedido)
    if (hInv) outMov[hInv] = "";

    if (hTipo) outMov[hTipo] = "Despacho";
    if (hCantU) outMov[hCantU] = cantidadDespachadaUnd;
    if (hCantM) outMov[hCantM] = 0;
    if (hAO) outMov[hAO] = "Almacén";
    if (hAD) outMov[hAD] = "Despacho";
    if (hPed) outMov[hPed] = pedidosKey;

    if (hRef) outMov[hRef] = `${pedidosKey} - row ${pedidoRowIndex}`;
    if (hMot) outMov[hMot] = completo ? "Despacho completo" : "Despacho parcial";
    if (hFecha) outMov[hFecha] = fechaISO;
    if (hUser) outMov[hUser] = usuario;

    await appendRow(sheets, SHEET_MOV, buildRow(movHeaders, outMov));

    // =========================
    // 5) Update en PEDIDOS (Estado + Fecha Real Despacho + docs)
    // =========================
    const updates: Array<{ colIndex0Based: number; value: any }> = [];

    updates.push({ colIndex0Based: idxEstado, value: completo ? "Despachado" : "Despacho parcial" });

    if (idxFechaReal >= 0) updates.push({ colIndex0Based: idxFechaReal, value: fechaISO });
    if (show(idxTransp, transporte)) updates.push({ colIndex0Based: idxTransp, value: transporte });
    if (show(idxGuia, guia)) updates.push({ colIndex0Based: idxGuia, value: guia });
    if (show(idxFactura, factura)) updates.push({ colIndex0Based: idxFactura, value: factura });
    if (show(idxRemision, remision)) updates.push({ colIndex0Based: idxRemision, value: remision });

    await updateCells(sheets, SHEET_PEDIDOS, pedidoRowIndex, updates);

    return NextResponse.json({
      success: true,
      despachoId,
      pedidosKey,
      pedidoRowIndex,
      solicitadoUnd,
      yaDespachado,
      despachadoNuevoTotal: nuevoTotal,
      pendienteUnd: pendiente,
      completo,
      fechaISO,
      movimientoId: movId,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en /logistica/despachar" },
      { status: 500 }
    );
  }
}

function show(idx: number, val: string) {
  return idx >= 0 && !!String(val || "").trim();
}

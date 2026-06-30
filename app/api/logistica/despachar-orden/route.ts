import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function lower(v: any) {
  return norm(v).toLowerCase();
}
function soft(v: any) {
  return norm(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function toISODateTimeOrThrow(input: any) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let d: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d = new Date(`${raw}T12:00:00.000Z`);
  } else {
    d = new Date(raw);
  }

  if (isNaN(d.getTime())) throw new Error("fechaRealDespacho inválida");
  return d.toISOString();
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

  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  const low = headers.map((h) => h.toLowerCase());

  for (const c of candidates) {
    const i = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (i >= 0) return i;
  }

  return -1;
}

function pickHeader(headers: string[], candidates: string[]) {
  const hm = headerMap(headers);

  for (const c of candidates) {
    if (hm.has(c)) return c;
  }

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

async function appendRows(sheets: any, sheetName: string, rows: any[][]) {
  if (!rows.length) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
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

async function batchUpdatePedidos(
  sheets: any,
  updates: Array<{ rowNumber1Based: number; colIndex0Based: number; value: any }>
) {
  if (!updates.length) return;

  const data = updates.map((u) => {
    const col = numToCol(u.colIndex0Based + 1);

    return {
      range: `${SHEET_PEDIDOS}!${col}${u.rowNumber1Based}`,
      values: [[u.value ?? ""]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

const COL_PED = {
   pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  consecutivo: ["Consecutivo", "consecutivo"],
  cliente: ["Cliente", "cliente"],
  oc: ["Orden de Compra", "Orden Compra", "OC", "oc"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "Dirección",
    "Direccion",
    "direccion",
  ],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)"],
  estado: ["Estado", "estado"],
  fechaRealDespacho: ["Fecha Real Despacho", "fecha real despacho"],
  transporte: ["Transporte", "transporte"],
  guia: ["Guia", "Guía", "guia", "guía"],
  factura: ["Factura", "factura"],
  remision: ["Remision", "Remisión", "remision", "remisión"],
};

const COL_DESP = {
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
  tipoMovimiento: ["tipoMovimiento", "TipoMovimiento", "tipoMov"],
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

type Body = {
  agruparPor: "pedido" | "clienteDireccion";
  groupKey: string;
  usuario: string;

  cliente?: string;
  direccion?: string;
  oc?: string;

  fechaRealDespacho?: string;
  transporte?: string;
  guia?: string;
  factura?: string;
  remision?: string;
  observaciones?: string;
};

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const body = (await req.json()) as Partial<Body>;

    const agruparPor = body.agruparPor || "pedido";
    const groupKey = norm(body.groupKey);
    const usuario = norm(body.usuario);

    const transporte = norm(body.transporte);
    const guia = norm(body.guia);
    const factura = norm(body.factura);
    const remision = norm(body.remision);
    const observaciones = norm(body.observaciones);
    const clienteFallback = norm(body.cliente);
const direccionFallback = norm(body.direccion);
const ocFallback = norm(body.oc);

    if (!groupKey) {
      return NextResponse.json({ success: false, message: "Falta groupKey" }, { status: 400 });
    }

    if (!usuario) {
      return NextResponse.json({ success: false, message: "Falta usuario" }, { status: 400 });
    }

    const fechaISO = toISODateTimeOrThrow(body.fechaRealDespacho) ?? new Date().toISOString();

    const sheets = await getSheets();

    const [
      { headers: pedH, rows: pedR },
      { headers: desH, rows: desR },
      { headers: movH },
    ] = await Promise.all([
      readSheetAll(sheets, SHEET_PEDIDOS),
      readSheetAll(sheets, SHEET_DESPACHOS),
      readSheetAll(sheets, SHEET_MOV),
    ]);

    const iKey = findCol(pedH, COL_PED.pedidosKey);
const iCli = findCol(pedH, COL_PED.cliente);
const iDir = findCol(pedH, COL_PED.direccion);
const iOc = findCol(pedH, COL_PED.oc);
const iUnd = findCol(pedH, COL_PED.cantidadUnd);
    const iEst = findCol(pedH, COL_PED.estado);
    const iFechaReal = findCol(pedH, COL_PED.fechaRealDespacho);
    const iTransp = findCol(pedH, COL_PED.transporte);
    const iGuia = findCol(pedH, COL_PED.guia);
    const iFactura = findCol(pedH, COL_PED.factura);
    const iRemision = findCol(pedH, COL_PED.remision);

    if (iKey < 0 || iUnd < 0 || iEst < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No pude mapear columnas mínimas en Pedidos: pedidosKey, Cantidad (und), Estado.",
        },
        { status: 500 }
      );
    }

    if (!desH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja Despachos no tiene headers." },
        { status: 500 }
      );
    }

    if (!movH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja MovimientosInventario no tiene headers." },
        { status: 500 }
      );
    }

    const dKey = findCol(desH, COL_DESP.pedidosKey);
    const dRow = findCol(desH, COL_DESP.pedidoRowIndex);
    const dCant = findCol(desH, COL_DESP.cantidadUnd);

    if (dKey < 0 || dRow < 0 || dCant < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No pude mapear columnas mínimas en Despachos: pedidosKey, pedidoRowIndex, cantidad.",
        },
        { status: 500 }
      );
    }

    const sumDespachado = new Map<string, number>();

    for (const r of desR) {
      const pk = norm(r[dKey]);
      const rowIdx = Math.floor(safeNum(r[dRow]));
      const cant = safeNum(r[dCant]);

      if (!pk || !rowIdx || cant <= 0) continue;

      const k = `${pk}__${rowIdx}`;
      sumDespachado.set(k, (sumDespachado.get(k) || 0) + cant);
    }

const rowsToDispatch: Array<{
  pedidosKey: string;
  pedidoRowIndex: number;
  pendienteUnd: number;
}> = [];

let matchedRows = 0;

for (let idx0 = 0; idx0 < pedR.length; idx0++) {
      const r = pedR[idx0];

      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const cliente = iCli >= 0 ? norm(r[iCli]) : "";
      const direccionDespacho = iDir >= 0 ? norm(r[iDir]) : "";
      const clienteDireccion = `${cliente} - ${direccionDespacho}`.replace(/\s+/g, " ").trim();

      const currentGroupKey = agruparPor === "clienteDireccion" ? clienteDireccion : pedidosKey;

      if (currentGroupKey !== groupKey) continue;

matchedRows += 1;

const pedidoRowIndex = idx0 + 2;
const solicitado = safeNum(r[iUnd]);
const yaDespachado = sumDespachado.get(`${pedidosKey}__${pedidoRowIndex}`) || 0;
const pendienteUnd = Math.max(0, solicitado - yaDespachado);

// Primero descartamos filas sin pendiente.
// Así no bloquean filas ya despachadas o sin cantidad pendiente.
if (pendienteUnd <= 0) continue;

const estado = lower(r[iEst]);
const listo = estado === "almacén" || estado === "almacen";

if (!listo) {
  return NextResponse.json(
    {
      success: false,
      message: "No se puede despachar este grupo porque tiene ítems pendientes que todavía no están en Almacén.",
    },
    { status: 409 }
  );
}

      rowsToDispatch.push({
        pedidosKey,
        pedidoRowIndex,
        pendienteUnd,
      });
    }

    if (!rowsToDispatch.length) {
  if (matchedRows > 0) {
    return NextResponse.json({
      success: true,
      agruparPor,
      groupKey,
      itemsDespachados: 0,
      unidadesDespachadas: 0,
      fechaISO,
      alreadyDispatched: true,
      message:
        "Este pedido ya no tiene ítems pendientes por despachar. Se puede cerrar en la secuencia.",
    });
  }

  return NextResponse.json(
    {
      success: false,
      message: "No encontré filas en Pedidos para este grupo.",
    },
    { status: 404 }
  );
}

    const desRowsToAppend: any[][] = [];
    const movRowsToAppend: any[][] = [];
    const pedUpdates: Array<{ rowNumber1Based: number; colIndex0Based: number; value: any }> = [];

    const hDesId = pickHeader(desH, COL_DESP.despachoId);
    const hDesFecha = pickHeader(desH, COL_DESP.fecha);
    const hDesPk = pickHeader(desH, COL_DESP.pedidosKey);
    const hDesRow = pickHeader(desH, COL_DESP.pedidoRowIndex);
    const hDesCant = pickHeader(desH, COL_DESP.cantidadUnd);
    const hDesUser = pickHeader(desH, COL_DESP.usuario);
    const hDesTrans = pickHeader(desH, COL_DESP.transporte);
    const hDesGuia = pickHeader(desH, COL_DESP.guia);
    const hDesFact = pickHeader(desH, COL_DESP.factura);
    const hDesRem = pickHeader(desH, COL_DESP.remision);
    const hDesObs = pickHeader(desH, COL_DESP.observaciones);

    const hMovId = pickHeader(movH, COL_MOV.movimientoId);
    const hInv = pickHeader(movH, COL_MOV.inventarioId);
    const hTipo = pickHeader(movH, COL_MOV.tipoMovimiento);
    const hCantU = pickHeader(movH, COL_MOV.cantidadUnd);
    const hCantM = pickHeader(movH, COL_MOV.cantidadM);
    const hAO = pickHeader(movH, COL_MOV.almacenOrigen);
    const hAD = pickHeader(movH, COL_MOV.almacenDestino);
    const hPed = pickHeader(movH, COL_MOV.pedidoKey);
    const hRef = pickHeader(movH, COL_MOV.referenciaOperacion);
    const hMot = pickHeader(movH, COL_MOV.motivo);
    const hFecha = pickHeader(movH, COL_MOV.fechaMovimiento);
    const hUser = pickHeader(movH, COL_MOV.usuario);

    for (const item of rowsToDispatch) {
      const despachoId = uid("DESP");
      const movimientoId = uid("MOV");

      const outDes: Record<string, any> = {};

      if (hDesId) outDes[hDesId] = despachoId;
      if (hDesFecha) outDes[hDesFecha] = fechaISO;
      if (hDesPk) outDes[hDesPk] = item.pedidosKey;
      if (hDesRow) outDes[hDesRow] = item.pedidoRowIndex;
      if (hDesCant) outDes[hDesCant] = item.pendienteUnd;
      if (hDesUser) outDes[hDesUser] = usuario;
      if (hDesTrans && transporte) outDes[hDesTrans] = transporte;
      if (hDesGuia && guia) outDes[hDesGuia] = guia;
      if (hDesFact && factura) outDes[hDesFact] = factura;
      if (hDesRem && remision) outDes[hDesRem] = remision;
      if (hDesObs && observaciones) outDes[hDesObs] = observaciones;

      desRowsToAppend.push(buildRow(desH, outDes));

      const outMov: Record<string, any> = {};

      if (hMovId) outMov[hMovId] = movimientoId;
      if (hInv) outMov[hInv] = "";
      if (hTipo) outMov[hTipo] = "Despacho";
      if (hCantU) outMov[hCantU] = item.pendienteUnd;
      if (hCantM) outMov[hCantM] = 0;
      if (hAO) outMov[hAO] = "Almacén";
      if (hAD) outMov[hAD] = "Despacho";
      if (hPed) outMov[hPed] = item.pedidosKey;
      if (hRef) outMov[hRef] = `${item.pedidosKey} - row ${item.pedidoRowIndex}`;
      if (hMot) outMov[hMot] = "Despacho completo por grupo";
      if (hFecha) outMov[hFecha] = fechaISO;
      if (hUser) outMov[hUser] = usuario;

      movRowsToAppend.push(buildRow(movH, outMov));

      pedUpdates.push({
        rowNumber1Based: item.pedidoRowIndex,
        colIndex0Based: iEst,
        value: "Despachado",
      });

      if (iFechaReal >= 0) {
        pedUpdates.push({
          rowNumber1Based: item.pedidoRowIndex,
          colIndex0Based: iFechaReal,
          value: fechaISO,
        });
      }

      if (iTransp >= 0 && transporte) {
        pedUpdates.push({
          rowNumber1Based: item.pedidoRowIndex,
          colIndex0Based: iTransp,
          value: transporte,
        });
      }

      if (iGuia >= 0 && guia) {
        pedUpdates.push({
          rowNumber1Based: item.pedidoRowIndex,
          colIndex0Based: iGuia,
          value: guia,
        });
      }

      if (iFactura >= 0 && factura) {
        pedUpdates.push({
          rowNumber1Based: item.pedidoRowIndex,
          colIndex0Based: iFactura,
          value: factura,
        });
      }

      if (iRemision >= 0 && remision) {
        pedUpdates.push({
          rowNumber1Based: item.pedidoRowIndex,
          colIndex0Based: iRemision,
          value: remision,
        });
      }
    }

    await appendRows(sheets, SHEET_DESPACHOS, desRowsToAppend);
    await appendRows(sheets, SHEET_MOV, movRowsToAppend);
    await batchUpdatePedidos(sheets, pedUpdates);

    return NextResponse.json({
      success: true,
      agruparPor,
      groupKey,
      itemsDespachados: rowsToDispatch.length,
      unidadesDespachadas: rowsToDispatch.reduce((acc, x) => acc + x.pendienteUnd, 0),
      fechaISO,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      { success: false, message: err?.message || "Error en /logistica/despachar-orden" },
      { status: 500 }
    );
  }
}
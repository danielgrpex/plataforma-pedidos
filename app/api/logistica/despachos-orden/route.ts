import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_PEDIDOS = "Pedidos";
const SHEET_DESPACHOS = "Despachos";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function lower(v: any) {
  return norm(v).toLowerCase();
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

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  consecutivo: ["Consecutivo", "consecutivo"],
  cliente: ["Cliente", "cliente"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "Dirección",
    "Direccion",
    "direccion",
  ],
  oc: ["OC", "Orden de compra", "Orden Compra", "ordenCompra", "oc"],
  producto: ["Producto", "producto"],
referencia: ["Referencia", "referencia"],
color: ["Color", "color"],
ancho: ["Ancho", "ancho"],
largo: ["Largo", "largo"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)"],
  estado: ["Estado", "estado"],
};

const COL_DESP = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  cantidad: ["cantidadDespachadaUnd", "CantidadDespachadaUnd", "cantidadUnd", "cantidad"],
};

export async function GET(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const url = new URL(req.url);
    const agruparPor = url.searchParams.get("agruparPor") || "pedido";

    const sheets = await getSheets();

    const [{ headers: pedH, rows: pedR }, { headers: desH, rows: desR }] = await Promise.all([
      readSheetAll(sheets, SHEET_PEDIDOS),
      readSheetAll(sheets, SHEET_DESPACHOS),
    ]);

    const iKey = findCol(pedH, COL_PED.pedidosKey);
    const iCon = findCol(pedH, COL_PED.consecutivo);
    const iCli = findCol(pedH, COL_PED.cliente);
    const iDir = findCol(pedH, COL_PED.direccion);
    const iOc = findCol(pedH, COL_PED.oc);
    const iProd = findCol(pedH, COL_PED.producto);
const iRef = findCol(pedH, COL_PED.referencia);
const iColor = findCol(pedH, COL_PED.color);
const iAncho = findCol(pedH, COL_PED.ancho);
const iLargo = findCol(pedH, COL_PED.largo);
    const iUnd = findCol(pedH, COL_PED.cantidadUnd);
    const iEst = findCol(pedH, COL_PED.estado);

    if (iKey < 0 || iUnd < 0 || iEst < 0) {
      return NextResponse.json(
        {
          success: false,
          message: `No pude mapear columnas mínimas en Pedidos: pedidosKey, Cantidad (und), Estado.`,
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const dKey = desH.length ? findCol(desH, COL_DESP.pedidosKey) : -1;
    const dRow = desH.length ? findCol(desH, COL_DESP.pedidoRowIndex) : -1;
    const dCant = desH.length ? findCol(desH, COL_DESP.cantidad) : -1;

    const sumDespachado = new Map<string, number>();

    if (desH.length && dKey >= 0 && dRow >= 0 && dCant >= 0) {
      for (const r of desR) {
        const pk = norm(r[dKey]);
        const rowIdx = Math.floor(safeNum(r[dRow]));
        const cant = safeNum(r[dCant]);

        if (!pk || !rowIdx || cant <= 0) continue;

        const k = `${pk}__${rowIdx}`;
        sumDespachado.set(k, (sumDespachado.get(k) || 0) + cant);
      }
    }

    const grupos = new Map<string, any>();

    for (let idx0 = 0; idx0 < pedR.length; idx0++) {
      const r = pedR[idx0];

      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const pedidoRowIndex = idx0 + 2;
      const solicitado = safeNum(r[iUnd]);
      const estado = norm(r[iEst]);
      const est = lower(estado);
      const estadoExcluido =
  est === "rechazado" ||
  est === "cancelado" ||
  est.includes("rechazado") ||
  est.includes("cancelado");

if (estadoExcluido) continue;

      if (solicitado <= 0) continue;

      const yaDespachado = sumDespachado.get(`${pedidosKey}__${pedidoRowIndex}`) || 0;
      const pendiente = Math.max(0, solicitado - yaDespachado);

      if (pendiente <= 0) continue;

      const cliente = iCli >= 0 ? norm(r[iCli]) : "";
      const direccionDespacho = iDir >= 0 ? norm(r[iDir]) : "";
      const consecutivo = iCon >= 0 ? norm(r[iCon]) : "";
      const oc = iOc >= 0 ? norm(r[iOc]) : "";

      const clienteDireccion = `${cliente} - ${direccionDespacho}`.replace(/\s+/g, " ").trim();

      const groupKey =
        agruparPor === "clienteDireccion"
          ? clienteDireccion || `${cliente}|${direccionDespacho}`
          : pedidosKey;

      const label =
        agruparPor === "clienteDireccion"
          ? clienteDireccion || "Sin cliente - dirección"
          : `Pedido ${consecutivo || pedidosKey}`;

      if (!grupos.has(groupKey)) {
        grupos.set(groupKey, {
  groupKey,
  label,
  oc,
  consecutivo,
  cliente,
  direccionDespacho,
  itemsTotales: 0,
  itemsListos: 0,
  cantidadTotalUnd: 0,
  estado: "Incompleto",
  itemsResumen: [],
});
      }

      const g = grupos.get(groupKey);

      g.itemsTotales += 1;
      g.cantidadTotalUnd += pendiente;

      const listo = est === "almacén" || est === "almacen";
      if (listo) g.itemsListos += 1;

      if (!g.oc && oc) g.oc = oc;
      if (!g.consecutivo && consecutivo) g.consecutivo = consecutivo;
      const producto = iProd >= 0 ? norm(r[iProd]) : "";
const referencia = iRef >= 0 ? norm(r[iRef]) : "";
const color = iColor >= 0 ? norm(r[iColor]) : "";
const ancho = iAncho >= 0 ? norm(r[iAncho]) : "";
const largo = iLargo >= 0 ? norm(r[iLargo]) : "";

const productoLabel = [producto, referencia, color, ancho, largo]
  .filter(Boolean)
  .join(" | ");

g.itemsResumen.push({
  producto: productoLabel || producto || "-",
  cantidadUnd: pendiente,
  estado: estado || "Almacén",
});
    }

const items = Array.from(grupos.values())
  .filter((g) => g.itemsListos > 0)
  .map((g) => ({
    ...g,
    estado: g.itemsTotales > 0 && g.itemsTotales === g.itemsListos ? "Listo" : "Incompleto",
  }));

    items.sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "Listo" ? -1 : 1;
      return String(a.label).localeCompare(String(b.label));
    });

    return NextResponse.json(
      { success: true, count: items.length, items },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en /logistica/despachos-orden" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
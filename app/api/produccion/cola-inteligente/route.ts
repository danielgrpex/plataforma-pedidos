import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_PEDIDOS = "Pedidos";
const SHEET_SOL_PROD = "SolicitudesProduccion";
const SHEET_SOL_CORTE = "SolicitudesCorte";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

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

function parseDateLoose(v: any): Date | null {
  const raw = norm(v);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date) {
  const ms = 24 * 60 * 60 * 1000;
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / ms);
}

function formatDate(v: any) {
  const d = parseDateLoose(v);
  if (!d) return norm(v);
  return d.toLocaleDateString("es-CO", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  consecutivo: ["Consecutivo", "consecutivo"],
  fechaSolicitud: ["Fecha de Solicitud", "Fecha Solicitud", "fechaSolicitud"],
  fechaRequerida: ["Fecha Requerida Cliente", "Fecha requerida cliente", "fechaRequeridaCliente"],
  cliente: ["Cliente", "cliente"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "Dirección",
    "Direccion",
  ],
  ordenCompra: ["Orden de Compra", "Orden Compra", "OC", "oc"],
  producto: ["Producto", "producto"],
  referencia: ["Referencia", "referencia"],
  color: ["Color", "color"],
  ancho: ["Ancho", "ancho"],
  largo: ["Largo", "largo"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)", "Cantidad"],
  estado: ["Estado", "estado"],
  clasificacionPlaneacion: ["Clasificación Planeación", "Clasificacion Planeacion"],
  estadoPlaneacion: ["Estado Planeación", "Estado Planeacion"],
};

type PedidoRow = {
  rowIndex: number;
  pedidosKey: string;
  consecutivo: string;
  fechaSolicitudRaw: string;
  fechaRequeridaRaw: string;
  cliente: string;
  producto: string;
  cantidadUnd: number;
  estado: string;
  est: string;
  direccion: string;
ordenCompra: string;
};

function estadoExcluido(est: string) {
  return (
    est.includes("rechazado") ||
    est.includes("cancelado") ||
    est.includes("despachado") ||
    est.includes("entregado")
  );
}

function estadoEnAlmacen(est: string) {
  return est === "almacén" || est === "almacen";
}

function estadoTrabajable(est: string) {
  return (
    est.includes("producción") ||
    est.includes("produccion") ||
    est.includes("corte") ||
    est.includes("empaque")
  );
}

function productoLabel(parts: {
  producto: string;
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
}) {
  const producto = norm(parts.producto);

  // Si Producto ya viene armado con separadores, no le agregamos referencia/color/ancho/largo.
  if (producto.includes("|")) return producto;

  return [producto, parts.referencia, parts.color, parts.ancho, parts.largo]
    .map(norm)
    .filter(Boolean)
    .join(" | ");
}

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const sheets = await getSheets();
    const [
  { headers, rows },
  { headers: prodH, rows: prodR },
  { headers: corteH, rows: corteR },
] = await Promise.all([
  readSheetAll(sheets, SHEET_PEDIDOS),
  readSheetAll(sheets, SHEET_SOL_PROD),
  readSheetAll(sheets, SHEET_SOL_CORTE),
]);

    if (!headers.length) {
      return NextResponse.json(
        { success: false, message: "La hoja Pedidos no tiene encabezados." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const iKey = findCol(headers, COL_PED.pedidosKey);
    const iCon = findCol(headers, COL_PED.consecutivo);
    const iFSol = findCol(headers, COL_PED.fechaSolicitud);
    const iFReq = findCol(headers, COL_PED.fechaRequerida);
    const iCli = findCol(headers, COL_PED.cliente);
    const iDir = findCol(headers, COL_PED.direccion);
const iOC = findCol(headers, COL_PED.ordenCompra);
    const iProd = findCol(headers, COL_PED.producto);
    const iRef = findCol(headers, COL_PED.referencia);
    const iColor = findCol(headers, COL_PED.color);
    const iAncho = findCol(headers, COL_PED.ancho);
    const iLargo = findCol(headers, COL_PED.largo);
    const iCant = findCol(headers, COL_PED.cantidadUnd);
    const iEst = findCol(headers, COL_PED.estado);

    if (iKey < 0 || iEst < 0 || iProd < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No pude mapear columnas mínimas en Pedidos: pedidosKey, Estado, Producto.",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const PROD_COL = {
  rowIndexPedido: ["rowIndexPedido", "RowIndexPedido", "rowIndex"],
  ope: ["OPE", "ope"],
  solicitudProdId: ["solicitudProdId", "SolicitudProdId"],
};

const CORTE_COL = {
  rowIndexPedido: ["rowIndexPedido", "RowIndexPedido", "rowIndex"],
  ote: ["OTE", "ote"],
  orden: ["Orden", "orden"],
  solicitudCorteId: ["solicitudCorteId", "SolicitudCorteId"],
};

const prodByRowIndex = new Map<number, string[]>();
const corteByRowIndex = new Map<number, string[]>();

const pRow = findCol(prodH, PROD_COL.rowIndexPedido);
const pOpe = findCol(prodH, PROD_COL.ope);
const pId = findCol(prodH, PROD_COL.solicitudProdId);

if (prodH.length && pRow >= 0) {
  for (const r of prodR) {
    const rowIdx = Math.floor(safeNum(r[pRow]));
    if (!rowIdx) continue;

    const ope = pOpe >= 0 ? norm(r[pOpe]) : "";
    const id = pId >= 0 ? norm(r[pId]) : "";

    const label = ope ? `OPE ${ope}` : id ? `Producción ${id}` : "Producción";

    const arr = prodByRowIndex.get(rowIdx) || [];
    if (!arr.includes(label)) arr.push(label);
    prodByRowIndex.set(rowIdx, arr);
  }
}

const cRow = findCol(corteH, CORTE_COL.rowIndexPedido);
const cOte = findCol(corteH, CORTE_COL.ote);
const cOrden = findCol(corteH, CORTE_COL.orden);
const cId = findCol(corteH, CORTE_COL.solicitudCorteId);

if (corteH.length && cRow >= 0) {
  for (const r of corteR) {
    const rowIdx = Math.floor(safeNum(r[cRow]));
    if (!rowIdx) continue;

    const ote = cOte >= 0 ? norm(r[cOte]) : "";
    const orden = cOrden >= 0 ? norm(r[cOrden]) : "";
    const id = cId >= 0 ? norm(r[cId]) : "";

    const label = ote
      ? `OTE ${ote}`
      : orden
        ? `Corte ${orden}`
        : id
          ? `Corte ${id}`
          : "Corte";

    const arr = corteByRowIndex.get(rowIdx) || [];
    if (!arr.includes(label)) arr.push(label);
    corteByRowIndex.set(rowIdx, arr);
  }
}

    const validRows: PedidoRow[] = [];

    for (let idx0 = 0; idx0 < rows.length; idx0++) {
      const r = rows[idx0];

      const pedidosKey = norm(r[iKey]);
      const estado = norm(r[iEst]);
      const est = lower(estado);

      if (!pedidosKey) continue;
      if (estadoExcluido(est)) continue;

      const producto = productoLabel({
        producto: iProd >= 0 ? norm(r[iProd]) : "",
        referencia: iRef >= 0 ? norm(r[iRef]) : "",
        color: iColor >= 0 ? norm(r[iColor]) : "",
        ancho: iAncho >= 0 ? norm(r[iAncho]) : "",
        largo: iLargo >= 0 ? norm(r[iLargo]) : "",
      });

      validRows.push({
        rowIndex: idx0 + 2,
        pedidosKey,
        consecutivo: iCon >= 0 ? norm(r[iCon]) : pedidosKey,
        fechaSolicitudRaw: iFSol >= 0 ? norm(r[iFSol]) : "",
        fechaRequeridaRaw: iFReq >= 0 ? norm(r[iFReq]) : "",
        cliente: iCli >= 0 ? norm(r[iCli]) : "",
        direccion: iDir >= 0 ? norm(r[iDir]) : "",
ordenCompra: iOC >= 0 ? norm(r[iOC]) : "",
        producto: producto || "-",
        cantidadUnd: iCant >= 0 ? safeNum(r[iCant]) : 0,
        estado,
        est,
      });
    }

    const groupStats = new Map<
      string,
      {
        total: number;
        almacen: number;
      }
    >();

    for (const r of validRows) {
      const current = groupStats.get(r.pedidosKey) || { total: 0, almacen: 0 };
      current.total += 1;
      if (estadoEnAlmacen(r.est)) current.almacen += 1;
      groupStats.set(r.pedidosKey, current);
    }
    const todosItemsPorPedido = new Map<string, any[]>();

for (const r of validRows) {
  const arr = todosItemsPorPedido.get(r.pedidosKey) || [];

  arr.push({
    producto: r.producto,
    cantidadUnd: r.cantidadUnd,
    estado: r.estado,
    ordenesTrabajo: [
      ...(prodByRowIndex.get(r.rowIndex) || []),
      ...(corteByRowIndex.get(r.rowIndex) || []),
    ].join(" / "),
  });

  todosItemsPorPedido.set(r.pedidosKey, arr);
}

    const today = new Date();
    const items = [];

    for (const r of validRows) {
      if (!estadoTrabajable(r.est)) continue;

      const stats = groupStats.get(r.pedidosKey) || { total: 1, almacen: 0 };

      const completaPedido = stats.almacen + 1 >= stats.total;

      const fechaSolicitud = parseDateLoose(r.fechaSolicitudRaw);
      const fechaRequerida = parseDateLoose(r.fechaRequeridaRaw);

      const diasAbierto = fechaSolicitud ? Math.max(0, daysBetween(fechaSolicitud, today)) : 0;
      const diasParaEntrega = fechaRequerida ? daysBetween(today, fechaRequerida) : 999;

      let puntaje = 0;
      const razones: string[] = [];

      if (completaPedido) {
        puntaje += 100;
        razones.push("Libera despacho completo");
      }

      if (diasParaEntrega < 0) {
        puntaje += 80;
        razones.push("Pedido vencido");
      } else if (diasParaEntrega <= 2) {
        puntaje += 60;
        razones.push("Entrega en 1-2 días");
      } else if (diasParaEntrega <= 5) {
        puntaje += 40;
        razones.push("Entrega en 3-5 días");
      }

      if (diasAbierto >= 10) {
        puntaje += 25;
        razones.push("Pedido antiguo");
      } else if (diasAbierto >= 5) {
        puntaje += 15;
        razones.push("Pedido abierto varios días");
      }

      if (r.est.includes("producción") || r.est.includes("produccion")) {
        puntaje += 20;
        razones.push("Viene de producción");
      }

      let prioridad: "CRÍTICA" | "ALTA" | "MEDIA" | "BAJA" = "BAJA";

      if (puntaje >= 100) prioridad = "CRÍTICA";
      else if (puntaje >= 60) prioridad = "ALTA";
      else if (puntaje >= 30) prioridad = "MEDIA";

      let accion = "PROGRAMAR";

      if (prioridad === "CRÍTICA") accion = "HACER YA";
      else if (prioridad === "ALTA") accion = "HACER HOY";
      else if (prioridad === "MEDIA") accion = "PROGRAMAR HOY";

      items.push({
        prioridad,
        puntaje,
        accion,
        razones,
        pedido: r.consecutivo || r.pedidosKey,
        pedidosKey: r.pedidosKey,
        cliente: r.cliente || "-",
        direccion: r.direccion || "",
ordenCompra: r.ordenCompra || "",
        producto: r.producto,
        cantidadUnd: r.cantidadUnd,
        estado: r.estado,
        ordenesTrabajo: [
  ...(prodByRowIndex.get(r.rowIndex) || []),
  ...(corteByRowIndex.get(r.rowIndex) || []),
].join(" / "),
        fechaSolicitud: formatDate(r.fechaSolicitudRaw),
        fechaRequerida: formatDate(r.fechaRequeridaRaw),
        diasAbierto,
        diasParaEntrega,
        avancePedido: `${stats.almacen}/${stats.total}`,
        completaPedido,
        itemsPedido: todosItemsPorPedido.get(r.pedidosKey) || [],
      });
    }

    items.sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return a.diasParaEntrega - b.diasParaEntrega;
    });

    return NextResponse.json(
      { success: true, count: items.length, items },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      { success: false, message: err?.message || "Error en /api/produccion/cola-inteligente" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
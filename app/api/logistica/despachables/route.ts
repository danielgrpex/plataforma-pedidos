// app/api/logistica/despachables/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;

const SHEET_PEDIDOS = "Pedidos";
const SHEET_DESPACHOS = "Despachos";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function norm(s: any) {
  return String(s ?? "").trim();
}

function lower(s: any) {
  return norm(s).toLowerCase();
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

function buildProductoKeyFromPedido(p: {
  producto: string;
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
}) {
  return `${p.producto}|${p.referencia}|${p.color}|${p.ancho}|${p.largo}|`
    .replace(/\s+/g, " ")
    .trim();
}

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  pedidosId: ["pedidosId", "PedidosId", "pedidoId", "PedidoId"],
  consecutivo: ["Consecutivo", "consecutivo"],
  cliente: ["Cliente", "cliente"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "direccion",
    "Dirección",
    "Direccion",
  ],
  producto: ["Producto", "producto"],
  referencia: ["Referencia", "referencia"],
  color: ["Color", "color"],
  ancho: ["Ancho", "ancho"],
  largo: ["Largo", "largo"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)"],
  estado: ["Estado", "estado"],
  fechaReq: ["Fecha Requerida Cliente", "fecha requerida cliente", "Fecha requerida cliente"],
};

const COL_DESP = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  cantidad: ["cantidadDespachadaUnd", "CantidadDespachadaUnd", "cantidadUnd", "cantidadUnds", "cantidad"],
};

// 🔥 OJO: este tipo es el que consume la UI
type DespachableUI = {
  pedidosKey: string;
  pedidoRowIndex: number; // fila real en la sheet Pedidos (1-based)
  producto: string;
  cantidadSolicitadaUnd: number;
  cantidadDespachadaUnd: number;
  pendienteUnd: number;
  estado: string;

  // extras (por si luego los quieres mostrar)
  cliente?: string;
  direccionDespacho?: string;
  productoKey?: string;
  fechaRequeridaCliente?: string;
  consecutivo?: string;
  pedidosId?: string;
};

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const [{ headers: pedH, rows: pedR }, { headers: desH, rows: desR }] = await Promise.all([
      readSheetAll(sheets, SHEET_PEDIDOS),
      readSheetAll(sheets, SHEET_DESPACHOS),
    ]);

    if (pedH.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` },
        { status: 500 }
      );
    }

    const iKey = findCol(pedH, COL_PED.pedidosKey);
    const iId = findCol(pedH, COL_PED.pedidosId);
    const iCon = findCol(pedH, COL_PED.consecutivo);
    const iCli = findCol(pedH, COL_PED.cliente);
    const iDir = findCol(pedH, COL_PED.direccion);
    const iProd = findCol(pedH, COL_PED.producto);
    const iRef = findCol(pedH, COL_PED.referencia);
    const iCol = findCol(pedH, COL_PED.color);
    const iAnc = findCol(pedH, COL_PED.ancho);
    const iLar = findCol(pedH, COL_PED.largo);
    const iUnd = findCol(pedH, COL_PED.cantidadUnd);
    const iEst = findCol(pedH, COL_PED.estado);
    const iFReq = findCol(pedH, COL_PED.fechaReq);

    if (iKey < 0 || iUnd < 0 || iEst < 0 || iProd < 0) {
      return NextResponse.json(
        {
          success: false,
          message: `No pude mapear columnas mínimas en ${SHEET_PEDIDOS} (pedidosKey, Cantidad(und), Estado, Producto).`,
        },
        { status: 500 }
      );
    }

    // --- Sumar despachado por (pedidosKey + pedidoRowIndex)
    const dKey = desH.length ? findCol(desH, COL_DESP.pedidosKey) : -1;
    const dRow = desH.length ? findCol(desH, COL_DESP.pedidoRowIndex) : -1;
    const dCant = desH.length ? findCol(desH, COL_DESP.cantidad) : -1;

    const sumDespachado = new Map<string, number>();
    if (desH.length > 0 && dKey >= 0 && dRow >= 0 && dCant >= 0) {
      for (const r of desR) {
        const pk = norm(r[dKey]);
        const rowIdx = Math.floor(safeNum(r[dRow]));
        const cant = safeNum(r[dCant]);
        if (!pk || !rowIdx || cant <= 0) continue;
        const k = `${pk}__${rowIdx}`;
        sumDespachado.set(k, (sumDespachado.get(k) || 0) + cant);
      }
    }

    const out: DespachableUI[] = [];

    for (let idx0 = 0; idx0 < pedR.length; idx0++) {
      const r = pedR[idx0];
      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const estado = norm(r[iEst]);
      const est = lower(estado);

      // Solo lo que está en almacén o despacho parcial
      const elegible = est === "almacén" || est === "almacen" || est === "despacho parcial";
      if (!elegible) continue;

      const solicitado = safeNum(r[iUnd]);
      if (solicitado <= 0) continue;

      // ✅ Esta es la fila real (1-based) en la sheet Pedidos
      const pedidoRowIndex = idx0 + 2;

      const k = `${pedidosKey}__${pedidoRowIndex}`;
      const despachado = sumDespachado.get(k) || 0;

      const pendiente = Math.max(0, solicitado - despachado);
      if (pendiente <= 0) continue;

      const producto = norm(r[iProd]);
      const referencia = iRef >= 0 ? norm(r[iRef]) : "";
      const color = iCol >= 0 ? norm(r[iCol]) : "";
      const ancho = iAnc >= 0 ? norm(r[iAnc]) : "";
      const largo = iLar >= 0 ? norm(r[iLar]) : "";

      const productoKey = buildProductoKeyFromPedido({ producto, referencia, color, ancho, largo });

      // ✅ Salida EXACTA para la UI
      out.push({
        pedidosKey,
        pedidoRowIndex,
        producto: productoKey || producto || "-",
        cantidadSolicitadaUnd: solicitado,
        cantidadDespachadaUnd: despachado,
        pendienteUnd: pendiente,
        estado: estado || "Almacén",

        // extras
        pedidosId: iId >= 0 ? norm(r[iId]) || undefined : undefined,
        consecutivo: iCon >= 0 ? norm(r[iCon]) || undefined : undefined,
        cliente: iCli >= 0 ? norm(r[iCli]) || undefined : undefined,
        direccionDespacho: iDir >= 0 ? norm(r[iDir]) || undefined : undefined,
        productoKey,
        fechaRequeridaCliente: iFReq >= 0 ? norm(r[iFReq]) || undefined : undefined,
      });
    }

    out.sort((a, b) =>
      a.pedidosKey !== b.pedidosKey ? a.pedidosKey.localeCompare(b.pedidosKey) : a.pedidoRowIndex - b.pedidoRowIndex
    );

    return NextResponse.json({ success: true, count: out.length, items: out });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en /logistica/despachables" },
      { status: 500 }
    );
  }
}

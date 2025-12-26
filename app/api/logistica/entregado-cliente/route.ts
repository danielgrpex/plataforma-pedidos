// app/api/logistica/entregado-cliente/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_PEDIDOS = "Pedidos";

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

// Columnas exactas (con heurísticas)
const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  estado: ["Estado", "estado"],
  fechaEntregaRealCliente: ["Fecha Entrega Real Cliente", "fecha entrega real cliente", "Fecha entrega real cliente"],
  cliente: ["Cliente", "cliente"],
  producto: ["Producto", "producto"],
  referencia: ["Referencia", "referencia"],
  color: ["Color", "color"],
  ancho: ["Ancho", "ancho"],
  largo: ["Largo", "largo"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)"],
};

type Confirmable = {
  pedidosKey: string;
  pedidoRowIndex: number; // fila real en Sheet Pedidos (1-based)
  cliente?: string;
  producto?: string;
  referencia?: string;
  color?: string;
  ancho?: string;
  largo?: string;
  cantidadUnd?: number;
  estado?: string;
};

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const { headers, rows } = await readSheetAll(sheets, SHEET_PEDIDOS);
    if (headers.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` }, { status: 500 });
    }

    const iKey = findCol(headers, COL_PED.pedidosKey);
    const iEst = findCol(headers, COL_PED.estado);
    const iFechaCli = findCol(headers, COL_PED.fechaEntregaRealCliente);

    if (iKey < 0 || iEst < 0 || iFechaCli < 0) {
      return NextResponse.json(
        { success: false, message: `No pude mapear columnas mínimas en Pedidos (pedidosKey, Estado, Fecha Entrega Real Cliente).` },
        { status: 500 }
      );
    }

    const iCli = findCol(headers, COL_PED.cliente);
    const iProd = findCol(headers, COL_PED.producto);
    const iRef = findCol(headers, COL_PED.referencia);
    const iCol = findCol(headers, COL_PED.color);
    const iAnc = findCol(headers, COL_PED.ancho);
    const iLar = findCol(headers, COL_PED.largo);
    const iUnd = findCol(headers, COL_PED.cantidadUnd);

    const items: Confirmable[] = [];

    for (let idx0 = 0; idx0 < rows.length; idx0++) {
      const r = rows[idx0];
      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const estado = norm(r[iEst]);
      const est = lower(estado);

      // SOLO los que ya están Despachado
      const esDespachado = est === "despachado";
      if (!esDespachado) continue;

      // y que aún NO tengan fecha real cliente
      const fechaCli = norm(r[iFechaCli]);
      if (fechaCli) continue;

      items.push({
        pedidosKey,
        pedidoRowIndex: idx0 + 2, // fila real (headers=1)
        cliente: iCli >= 0 ? norm(r[iCli]) || undefined : undefined,
        producto: iProd >= 0 ? norm(r[iProd]) || undefined : undefined,
        referencia: iRef >= 0 ? norm(r[iRef]) || undefined : undefined,
        color: iCol >= 0 ? norm(r[iCol]) || undefined : undefined,
        ancho: iAnc >= 0 ? norm(r[iAnc]) || undefined : undefined,
        largo: iLar >= 0 ? norm(r[iLar]) || undefined : undefined,
        cantidadUnd: iUnd >= 0 ? safeNum(r[iUnd]) : undefined,
        estado: estado || undefined,
      });
    }

    // orden por row
    items.sort((a, b) => a.pedidoRowIndex - b.pedidoRowIndex);

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err?.message || "Error en GET /logistica/entregado-cliente" }, { status: 500 });
  }
}

type Body = {
  usuario: string;
  pedidosKey: string;
  pedidoRowIndex: number; // fila real en Pedidos (1-based)
  fechaConfirmadaCliente: string; // "YYYY-MM-DD" o ISO
  observaciones?: string; // (por ahora solo UI, no lo guardamos en Pedidos porque no pediste columna)
};

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const body = (await req.json()) as Partial<Body>;

    const usuario = norm(body.usuario);
    const pedidosKey = norm(body.pedidosKey);
    const pedidoRowIndex = Math.floor(safeNum(body.pedidoRowIndex));
    const fechaConfirmadaClienteRaw = norm(body.fechaConfirmadaCliente);

    if (!usuario) return NextResponse.json({ success: false, message: "Falta usuario" }, { status: 400 });
    if (!pedidosKey) return NextResponse.json({ success: false, message: "Falta pedidosKey" }, { status: 400 });
    if (!pedidoRowIndex || pedidoRowIndex <= 1) {
      return NextResponse.json({ success: false, message: "pedidoRowIndex inválido (debe ser fila real en Pedidos)" }, { status: 400 });
    }
    if (!fechaConfirmadaClienteRaw) {
      return NextResponse.json({ success: false, message: "Falta fechaConfirmadaCliente" }, { status: 400 });
    }

    // Normalizamos fecha: si viene YYYY-MM-DD, lo dejamos así (Sheets lo entiende).
    // Si viene ISO, lo dejamos ISO.
    // Si viene raro, guardamos texto tal cual.
    let fechaGuardar = fechaConfirmadaClienteRaw;
    const d = new Date(fechaConfirmadaClienteRaw);
    if (!Number.isNaN(d.getTime()) && fechaConfirmadaClienteRaw.includes("T")) {
      fechaGuardar = d.toISOString();
    }

    // Leer headers Pedidos para mapear columnas
    const { headers, rows } = await readSheetAll(sheets, SHEET_PEDIDOS);
    if (headers.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` }, { status: 500 });
    }

    const iKey = findCol(headers, COL_PED.pedidosKey);
    const iEst = findCol(headers, COL_PED.estado);
    const iFechaCli = findCol(headers, COL_PED.fechaEntregaRealCliente);

    if (iKey < 0 || iEst < 0 || iFechaCli < 0) {
      return NextResponse.json(
        { success: false, message: `No pude mapear columnas mínimas en Pedidos (pedidosKey, Estado, Fecha Entrega Real Cliente).` },
        { status: 500 }
      );
    }

    // Validación: la fila corresponde al pedidosKey
    const idx0 = pedidoRowIndex - 2;
    if (idx0 < 0 || idx0 >= rows.length) {
      return NextResponse.json(
        { success: false, message: `pedidoRowIndex fuera de rango. Recibí ${pedidoRowIndex}` },
        { status: 400 }
      );
    }
    const pkEnFila = norm(rows[idx0][iKey]);
    if (pkEnFila !== pedidosKey) {
      return NextResponse.json(
        { success: false, message: `La fila ${pedidoRowIndex} no coincide con pedidosKey. (fila=${pkEnFila})` },
        { status: 400 }
      );
    }

    // Actualiza Estado + Fecha Entrega Real Cliente
    await updateCells(sheets, SHEET_PEDIDOS, pedidoRowIndex, [
      { colIndex0Based: iEst, value: "Entregado" },
      { colIndex0Based: iFechaCli, value: fechaGuardar },
    ]);

    return NextResponse.json({
      success: true,
      pedidosKey,
      pedidoRowIndex,
      estadoNuevo: "Entregado",
      fechaEntregaRealCliente: fechaGuardar,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err?.message || "Error en POST /logistica/entregado-cliente" }, { status: 500 });
  }
}

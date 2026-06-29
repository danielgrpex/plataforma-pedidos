import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;

const SHEET_PEDIDOS = "Pedidos";
const SHEET_SECUENCIA = "SecuenciaDespachos";

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

async function appendRow(sheets: any, sheetName: string, row: any[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

async function batchUpdateValues(sheets: any, updates: Array<{ range: string; value: any }>) {
  if (!updates.length) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: u.range,
        values: [[u.value ?? ""]],
      })),
    },
  });
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

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  consecutivo: ["Consecutivo", "consecutivo"],
  cliente: ["Cliente", "cliente"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "Dirección",
    "Direccion",
  ],
  oc: ["Orden de Compra", "Orden Compra", "OC", "oc"],
  fechaReq: ["Fecha Requerida Cliente", "Fecha requerida cliente", "fechaRequeridaCliente"],
  estado: ["Estado", "estado"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)", "Cantidad"],
};

const COL_SEC = {
  posicion: ["Posición", "Posicion", "posicion", "posición"],
  pedidosKey: ["PedidosKey", "pedidosKey", "PedidoKey", "pedidoKey"],
  cliente: ["Cliente", "cliente"],
  direccion: ["Dirección", "Direccion", "direccion"],
  oc: ["OC", "Orden de Compra", "Orden Compra", "oc"],
  prioridadManual: ["Prioridad Manual", "prioridadManual"],
  estado: ["Estado", "estado"],
  programadoPor: ["Programado por", "Programado Por", "programadoPor"],
  fechaProgramacion: ["Fecha Programación", "Fecha Programacion", "fechaProgramacion"],
  fechaEstimadaDespacho: ["Fecha Estimada Despacho", "fechaEstimadaDespacho"],
};

function esAlmacen(est: string) {
  return est === "almacén" || est === "almacen";
}

function esExcluido(est: string) {
  return (
    est.includes("rechazado") ||
    est.includes("cancelado") ||
    est.includes("despachado") ||
    est.includes("entregado")
  );
}

export async function GET(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const url = new URL(req.url);
    const fechaFiltro = norm(url.searchParams.get("fecha"));

    const sheets = await getSheets();

    const [{ headers: pedH, rows: pedR }, { headers: secH, rows: secR }] = await Promise.all([
      readSheetAll(sheets, SHEET_PEDIDOS),
      readSheetAll(sheets, SHEET_SECUENCIA),
    ]);

    if (!pedH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja Pedidos no tiene encabezados." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    if (!secH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja SecuenciaDespachos no tiene encabezados." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const iKey = findCol(pedH, COL_PED.pedidosKey);
    const iCon = findCol(pedH, COL_PED.consecutivo);
    const iCli = findCol(pedH, COL_PED.cliente);
    const iDir = findCol(pedH, COL_PED.direccion);
    const iOc = findCol(pedH, COL_PED.oc);
    const iReq = findCol(pedH, COL_PED.fechaReq);
    const iEst = findCol(pedH, COL_PED.estado);
    const iCant = findCol(pedH, COL_PED.cantidadUnd);

    if (iKey < 0 || iEst < 0) {
      return NextResponse.json(
        { success: false, message: "No pude mapear pedidosKey y Estado en Pedidos." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const sPos = findCol(secH, COL_SEC.posicion);
    const sKey = findCol(secH, COL_SEC.pedidosKey);
    const sCli = findCol(secH, COL_SEC.cliente);
    const sDir = findCol(secH, COL_SEC.direccion);
    const sOc = findCol(secH, COL_SEC.oc);
    const sPri = findCol(secH, COL_SEC.prioridadManual);
    const sEst = findCol(secH, COL_SEC.estado);
    const sProg = findCol(secH, COL_SEC.programadoPor);
    const sFecha = findCol(secH, COL_SEC.fechaProgramacion);
    const sFechaEstimada = findCol(secH, COL_SEC.fechaEstimadaDespacho);

    if (sPos < 0 || sKey < 0 || sEst < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No pude mapear columnas mínimas en SecuenciaDespachos: Posición, PedidosKey, Estado.",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const secuenciaCompleta = secR
      .map((r) => ({
        posicion: safeNum(r[sPos]),
        pedidosKey: norm(r[sKey]),
        cliente: sCli >= 0 ? norm(r[sCli]) : "",
        direccion: sDir >= 0 ? norm(r[sDir]) : "",
        oc: sOc >= 0 ? norm(r[sOc]) : "",
        prioridadManual: sPri >= 0 ? norm(r[sPri]) : "",
        estado: sEst >= 0 ? norm(r[sEst]) : "",
        programadoPor: sProg >= 0 ? norm(r[sProg]) : "",
        fechaProgramacion: sFecha >= 0 ? norm(r[sFecha]) : "",
        fechaEstimadaDespacho:
          sFechaEstimada >= 0 ? norm(r[sFechaEstimada]) : "",
      }))
      .filter((x) => {
        const est = lower(x.estado);
        return x.pedidosKey && !est.includes("despachado") && !est.includes("retirado");
      });

    const hoy = todayISO();

const represados = secuenciaCompleta
  .filter((x) => {
    return x.fechaEstimadaDespacho && x.fechaEstimadaDespacho < hoy;
  })
  .sort((a, b) => {
    if (a.fechaEstimadaDespacho !== b.fechaEstimadaDespacho) {
      return a.fechaEstimadaDespacho.localeCompare(b.fechaEstimadaDespacho);
    }
    return a.posicion - b.posicion;
  });

const secuencia = secuenciaCompleta
  .filter((x) => {
    if (!fechaFiltro) return true;
    return x.fechaEstimadaDespacho === fechaFiltro;
  })
  .sort((a, b) => a.posicion - b.posicion);

const futuros = secuenciaCompleta
  .filter((x) => {
    return x.fechaEstimadaDespacho && x.fechaEstimadaDespacho > hoy;
  })
  .sort((a, b) => {
    if (a.fechaEstimadaDespacho !== b.fechaEstimadaDespacho) {
      return a.fechaEstimadaDespacho.localeCompare(b.fechaEstimadaDespacho);
    }
    return a.posicion - b.posicion;
  });

    const yaEnSecuencia = new Set(secuenciaCompleta.map((x) => x.pedidosKey));

    const grupos = new Map<string, any>();

    for (const r of pedR) {
      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const estado = norm(r[iEst]);
      const est = lower(estado);

      if (esExcluido(est)) continue;

      const g = grupos.get(pedidosKey) || {
        pedidosKey,
        consecutivo: iCon >= 0 ? norm(r[iCon]) : "",
        cliente: iCli >= 0 ? norm(r[iCli]) : "",
        direccion: iDir >= 0 ? norm(r[iDir]) : "",
        oc: iOc >= 0 ? norm(r[iOc]) : "",
        fechaRequerida: iReq >= 0 ? norm(r[iReq]) : "",
        itemsTotales: 0,
        itemsAlmacen: 0,
        cantidadTotalUnd: 0,
      };

      g.itemsTotales += 1;
      if (esAlmacen(est)) g.itemsAlmacen += 1;
      if (iCant >= 0) g.cantidadTotalUnd += safeNum(r[iCant]);

      grupos.set(pedidosKey, g);
    }

    const disponibles = Array.from(grupos.values())
      .filter((g) => {
        if (yaEnSecuencia.has(g.pedidosKey)) return false;
        if (g.itemsTotales <= 0) return false;
        return g.itemsTotales === g.itemsAlmacen;
      })
      .sort((a, b) => String(a.fechaRequerida).localeCompare(String(b.fechaRequerida)));

    return NextResponse.json(
  {
    success: true,
    fecha: fechaFiltro || "",
    represados,
    secuencia,
    futuros,
    disponibles,
  },
  { status: 200, headers: NO_STORE_HEADERS }
);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error en secuencia de despachos" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const body = await req.json();

    const pedidosKey = norm(body.pedidosKey);
    const cliente = norm(body.cliente);
    const direccion = norm(body.direccion);
    const oc = norm(body.oc);
    const prioridadManual = norm(body.prioridadManual);
    const programadoPor = norm(body.programadoPor) || "Planeación";
    const fechaEstimadaDespacho = norm(body.fechaEstimadaDespacho) || todayISO();

    if (!pedidosKey) {
      return NextResponse.json({ success: false, message: "Falta pedidosKey" }, { status: 400 });
    }

    const sheets = await getSheets();

    const { headers: secH, rows: secR } = await readSheetAll(sheets, SHEET_SECUENCIA);

    if (!secH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja SecuenciaDespachos no tiene encabezados." },
        { status: 500 }
      );
    }

    const sPos = findCol(secH, COL_SEC.posicion);
    const sKey = findCol(secH, COL_SEC.pedidosKey);
    const sEst = findCol(secH, COL_SEC.estado);
    const sFechaEstimada = findCol(secH, COL_SEC.fechaEstimadaDespacho);

    if (sPos < 0 || sKey < 0 || sEst < 0 || sFechaEstimada < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Faltan columnas mínimas en SecuenciaDespachos: Posición, PedidosKey, Estado, Fecha Estimada Despacho.",
        },
        { status: 500 }
      );
    }

    const yaExiste = secR.some((r) => {
      const key = norm(r[sKey]);
      const estado = lower(r[sEst]);
      return key === pedidosKey && !estado.includes("despachado") && !estado.includes("retirado");
    });

    if (yaExiste) {
      return NextResponse.json(
        { success: false, message: "Este pedido ya está en la secuencia." },
        { status: 409 }
      );
    }

    const maxPos = secR.reduce((max, r) => {
      const fecha = norm(r[sFechaEstimada]);
      if (fecha !== fechaEstimadaDespacho) return max;
      return Math.max(max, safeNum(r[sPos]));
    }, 0);

    const posicion = maxPos + 1;

    const row = buildRow(secH, {
      [secH[sPos]]: posicion,
      [secH[sKey]]: pedidosKey,
      Cliente: cliente,
      Dirección: direccion,
      OC: oc,
      "Prioridad Manual": prioridadManual,
      [secH[sEst]]: "Programado",
      "Programado por": programadoPor,
      "Fecha Programación": new Date().toISOString(),
      "Fecha Estimada Despacho": fechaEstimadaDespacho,
    });

    await appendRow(sheets, SHEET_SECUENCIA, row);

    return NextResponse.json({ success: true, posicion }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error agregando a secuencia" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const body = await req.json();
    const action = norm(body.action);
    const pedidosKey = norm(body.pedidosKey);
    const fechaEstimadaDespacho = norm(body.fechaEstimadaDespacho);

    if (!pedidosKey) {
      return NextResponse.json({ success: false, message: "Falta pedidosKey" }, { status: 400 });
    }

    const sheets = await getSheets();
    const { headers: secH, rows: secR } = await readSheetAll(sheets, SHEET_SECUENCIA);

    const sPos = findCol(secH, COL_SEC.posicion);
    const sKey = findCol(secH, COL_SEC.pedidosKey);
    const sEst = findCol(secH, COL_SEC.estado);
    const sFechaEstimada = findCol(secH, COL_SEC.fechaEstimadaDespacho);

    if (sPos < 0 || sKey < 0 || sEst < 0 || sFechaEstimada < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Faltan columnas mínimas en SecuenciaDespachos: Posición, PedidosKey, Estado, Fecha Estimada Despacho.",
        },
        { status: 500 }
      );
    }

    const posCol = numToCol(sPos + 1);
    const estCol = numToCol(sEst + 1);
    const fechaCol = numToCol(sFechaEstimada + 1);

    const activeAll = secR
      .map((r, idx0) => ({
        rowNumber: idx0 + 2,
        posicion: safeNum(r[sPos]),
        pedidosKey: norm(r[sKey]),
        estado: norm(r[sEst]),
        fechaEstimadaDespacho: norm(r[sFechaEstimada]),
      }))
      .filter((x) => {
        const est = lower(x.estado);
        return x.pedidosKey && !est.includes("despachado") && !est.includes("retirado");
      });

    const currentGlobal = activeAll.find((x) => x.pedidosKey === pedidosKey);

    if (!currentGlobal) {
      return NextResponse.json(
        { success: false, message: "No encontré este pedido activo en la secuencia." },
        { status: 404 }
      );
    }

    if (action === "despachado") {
      await batchUpdateValues(sheets, [
        {
          range: `${SHEET_SECUENCIA}!${estCol}${currentGlobal.rowNumber}`,
          value: "Despachado",
        },
      ]);

      return NextResponse.json({ success: true });
    }

    if (action === "remove") {
      await batchUpdateValues(sheets, [
        {
          range: `${SHEET_SECUENCIA}!${estCol}${currentGlobal.rowNumber}`,
          value: "Retirado",
        },
      ]);

      return NextResponse.json({ success: true });
    }

    if (action === "changeDate") {
      const nuevaFecha = fechaEstimadaDespacho || todayISO();

      const maxPosNuevaFecha = activeAll.reduce((max, x) => {
        if (x.fechaEstimadaDespacho !== nuevaFecha) return max;
        if (x.pedidosKey === pedidosKey) return max;
        return Math.max(max, x.posicion);
      }, 0);

      await batchUpdateValues(sheets, [
        {
          range: `${SHEET_SECUENCIA}!${fechaCol}${currentGlobal.rowNumber}`,
          value: nuevaFecha,
        },
        {
          range: `${SHEET_SECUENCIA}!${posCol}${currentGlobal.rowNumber}`,
          value: maxPosNuevaFecha + 1,
        },
      ]);

      return NextResponse.json({ success: true });
    }

    const active = activeAll
      .filter((x) => x.fechaEstimadaDespacho === currentGlobal.fechaEstimadaDespacho)
      .sort((a, b) => a.posicion - b.posicion);

    const currentIndex = active.findIndex((x) => x.pedidosKey === pedidosKey);

    const targetIndex =
      action === "up" ? currentIndex - 1 : action === "down" ? currentIndex + 1 : currentIndex;

    if (targetIndex < 0 || targetIndex >= active.length || targetIndex === currentIndex) {
      return NextResponse.json({ success: true, message: "Sin cambios." });
    }

    const current = active[currentIndex];
    const target = active[targetIndex];

    await batchUpdateValues(sheets, [
      {
        range: `${SHEET_SECUENCIA}!${posCol}${current.rowNumber}`,
        value: target.posicion,
      },
      {
        range: `${SHEET_SECUENCIA}!${posCol}${target.rowNumber}`,
        value: current.posicion,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error actualizando secuencia" },
      { status: 500 }
    );
  }
}
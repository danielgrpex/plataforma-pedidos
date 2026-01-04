//app/api/planeacion/programacion/produccion/colas/add/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

type Linea = "Linea 1" | "Linea 2" | "Linea 3" | "Linea 4" | "Linea 5" | "Linea 6";
const LINEAS: Linea[] = ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5", "Linea 6"];

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normLinea(raw: unknown): Linea | "" {
  const s = toStr(raw).replace("Línea", "Linea").replace(/\s+/g, " ");
  if (LINEAS.includes(s as Linea)) return s as Linea;
  const n = toNum(s);
  if (n >= 1 && n <= 6) return `Linea ${n}` as Linea;
  return "";
}

type Body = {
  ope: string;
  linea: Linea;
  prioridad: { mode: "inicio" | "final" | "despues"; pos?: number };
  usuario?: string;
};

function colLetter(idx0: number) {
  // 0 -> A, 1 -> B ...
  let n = idx0 + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = toStr(h).toLowerCase();
    if (key) idx.set(key, i);
  });
  return idx;
}

async function ensureSheetWithHeader(sheets: any, title: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    fields: "sheets(properties(sheetId,title))",
  });

  const exists = (meta.data.sheets || []).some((s: any) => s?.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }

  // Si no hay header, lo ponemos en el formato estándar A:H
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${title}!A1:H1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const header = (headerResp.data.values?.[0] || []).map((x: any) => toStr(x));
  const hasSomething = header.some((x: string) => x);

  if (!hasSomething) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `${title}!A1:H1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          "id",
          "linea",
          "ope",
          "pos",
          "estado",
          "fechaCreacion",
          "fechaUltActualizacion",
          "usuario",
        ]],
      },
    });
  }
}

async function readColaRowsDynamic(sheets: any) {
  const SHEET = "ColaProduccion";

  // leemos header completo y datos
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${SHEET}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = (resp.data.values || []) as any[][];
  const headerRow = values[0] || [];
  const dataRows = values.length > 1 ? values.slice(1) : [];
  const headerIdx = buildHeaderIndex(headerRow);

  const idxId = headerIdx.get("id");
  const idxLinea = headerIdx.get("linea");
  const idxOpe = headerIdx.get("ope");
  const idxPos = headerIdx.get("pos");
  const idxEstado = headerIdx.get("estado");
  const idxFC = headerIdx.get("fechacreacion");
  const idxFUA = headerIdx.get("fechaultactualizacion");
  const idxUsuario = headerIdx.get("usuario");

  if (idxLinea == null || idxOpe == null || idxPos == null || idxEstado == null) {
    throw new Error("ColaProduccion: faltan columnas obligatorias (linea/ope/pos/estado). Revisa headers.");
  }

  const rows = dataRows.map((r, i) => {
    const rowNumber = i + 2;

    const linea = normLinea(r[idxLinea]);
    const ope = toStr(r[idxOpe]);
    const pos = Math.max(1, Math.floor(toNum(r[idxPos]) || 1));
    const estado = toStr(r[idxEstado]) || "En cola";

    const id = idxId == null ? "" : toStr(r[idxId]);
    const fechaCreacion = idxFC == null ? "" : toStr(r[idxFC]);
    const fechaUltActualizacion = idxFUA == null ? "" : toStr(r[idxFUA]);
    const usuario = idxUsuario == null ? "" : toStr(r[idxUsuario]);

    return {
      rowNumber,
      id,
      linea,
      ope,
      pos,
      estado,
      fechaCreacion,
      fechaUltActualizacion,
      usuario,
    };
  });

  return {
    headerRow,
    headerIdx,
    idxPos, // importante para hacer shift en la columna correcta
    rows,
  };
}

async function updateSolicitudesToEnCola(sheets: any, ope: string, usuario: string) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `SolicitudesProduccion!A:J`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values: any[][] = resp.data.values || [];
  if (values.length < 2) return 0;

  const header = values[0].map((h) => toStr(h));
  const colEstado = header.indexOf("estado");
  const colFechaUlt = header.indexOf("fechaUltActualizacion");
  const colUsuario = header.indexOf("usuario");
  const colOpe = header.indexOf("OPE");

  if (colEstado < 0 || colFechaUlt < 0 || colUsuario < 0 || colOpe < 0) {
    throw new Error("Faltan columnas en SolicitudesProduccion (estado/fechaUltActualizacion/usuario/OPE).");
  }

  const now = new Date().toISOString();
  const data: Array<{ range: string; values: any[][] }> = [];
  let count = 0;

  const toColLetter = (n: number) => colLetter(n);

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const rowOpe = toStr(row[colOpe]);
    if (rowOpe !== ope) continue;

    const sheetRow = i + 1;
    data.push({
      range: `SolicitudesProduccion!${toColLetter(colEstado)}${sheetRow}:${toColLetter(colEstado)}${sheetRow}`,
      values: [["En cola"]],
    });
    data.push({
      range: `SolicitudesProduccion!${toColLetter(colFechaUlt)}${sheetRow}:${toColLetter(colFechaUlt)}${sheetRow}`,
      values: [[now]],
    });
    data.push({
      range: `SolicitudesProduccion!${toColLetter(colUsuario)}${sheetRow}:${toColLetter(colUsuario)}${sheetRow}`,
      values: [[usuario]],
    });

    count += 1;
  }

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
  }

  return count;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const ope = toStr(body.ope);
    const linea = normLinea(body.linea) as Linea;
    const usuario = toStr(body.usuario) || "planeacion";
    const mode = body?.prioridad?.mode || "final";
    const posReq = toNum(body?.prioridad?.pos);

    if (!ope) return NextResponse.json({ success: false, message: "ope requerido" }, { status: 400 });
    if (!LINEAS.includes(linea))
      return NextResponse.json({ success: false, message: "linea inválida" }, { status: 400 });

    const sheets = await getSheetsClient();
    const SHEET = "ColaProduccion";
    await ensureSheetWithHeader(sheets, SHEET);

    const { headerRow, headerIdx, idxPos, rows } = await readColaRowsDynamic(sheets);

    const exists = rows.some((r) => r.ope === ope && (r.estado || "").toLowerCase() !== "finalizado");
    if (exists) {
      return NextResponse.json(
        { success: false, message: `La OPE ${ope} ya está en cola o programada.` },
        { status: 400 }
      );
    }

    const colaLinea = rows
      .filter((r) => r.linea === linea)
      .sort((a, b) => (a.pos || 0) - (b.pos || 0));

    let insertPos = 1;
    if (mode === "inicio") insertPos = 1;
    else if (mode === "final") insertPos = colaLinea.length + 1;
    else insertPos = Math.min(Math.max(2, Math.floor(posReq) + 1 || 2), colaLinea.length + 1);

    // shift pos >= insertPos
    const toShift = colaLinea.filter((r) => (r.pos || 0) >= insertPos);
    if (toShift.length) {
      const posCol = colLetter(idxPos); // columna real de "pos"
      const data: Array<{ range: string; values: any[][] }> = [];

      for (const r of toShift) {
        data.push({
          range: `${SHEET}!${posCol}${r.rowNumber}:${posCol}${r.rowNumber}`,
          values: [[(r.pos || 0) + 1]],
        });
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data },
      });
    }

    // armar fila según header
    const now = new Date().toISOString();
    const rowOut = new Array(Math.max(headerRow.length, 8)).fill("");

    const setByName = (name: string, value: any) => {
      const i = headerIdx.get(name.toLowerCase());
      if (i == null) return;
      rowOut[i] = value;
    };

    // id: lo dejamos vacío por ahora
    setByName("linea", linea);
    setByName("ope", ope);
    setByName("pos", insertPos);
    setByName("estado", "En cola");
    setByName("fechaCreacion", now);
    setByName("fechaUltActualizacion", now);
    setByName("usuario", usuario);

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `${SHEET}!A:Z`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowOut] },
    });

    const updatedSolicitudes = await updateSolicitudesToEnCola(sheets, ope, usuario);

    return NextResponse.json({
      success: true,
      message: `OPE ${ope} agregada a ${linea} en posición ${insertPos}`,
      insertPos,
      updatedSolicitudes,
    });
  } catch (e) {
    console.error("[colas/add POST]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error agregando a cola" },
      { status: 500 }
    );
  }
}

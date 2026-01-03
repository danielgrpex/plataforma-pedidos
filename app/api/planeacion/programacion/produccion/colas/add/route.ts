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
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type Body = {
  ope: string;
  linea: Linea;
  prioridad: { mode: "inicio" | "final" | "despues"; pos?: number };
  usuario?: string;
};

async function ensureSheet(sheets: any, title: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    fields: "sheets(properties(sheetId,title))",
  });

  const exists = (meta.data.sheets || []).some((s: any) => s?.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${title}!A1:F1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "linea",         // A
        "pos",           // B
        "ope",           // C
        "estado",        // D
        "fechaCreacion", // E
        "usuario",       // F
      ]],
    },
  });
}

async function readColaRows(sheets: any) {
  const SHEET = "ColaProduccion";
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${SHEET}!A2:F`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values: any[][] = resp.data.values || [];
  // Guardamos rowNumber real en sheet para poder actualizar posiciones
  return values.map((r, idx) => ({
    rowNumber: idx + 2, // porque empieza en A2
    linea: toStr(r[0]),
    pos: toNum(r[1]),
    ope: toStr(r[2]),
    estado: toStr(r[3]) || "En cola",
    fechaCreacion: toStr(r[4]),
    usuario: toStr(r[5]),
  }));
}

async function updateSolicitudesToEnCola(sheets: any, ope: string, usuario: string) {
  // SolicitudesProduccion columnas (según tu hoja):
  // A solicitudProdId
  // ...
  // F estado
  // H fechaUltActualizacion
  // I usuario
  // J OPE
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `SolicitudesProduccion!A:J`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values: any[][] = resp.data.values || [];
  if (values.length < 2) return 0;

  const header = values[0].map((h) => toStr(h));
  const colEstado = header.indexOf("estado"); // F
  const colFechaUlt = header.indexOf("fechaUltActualizacion"); // H
  const colUsuario = header.indexOf("usuario"); // I
  const colOpe = header.indexOf("OPE"); // J

  if (colEstado < 0 || colFechaUlt < 0 || colUsuario < 0 || colOpe < 0) {
    throw new Error("Faltan columnas en SolicitudesProduccion (estado/fechaUltActualizacion/usuario/OPE).");
  }

  const now = new Date().toISOString();
  const data: Array<{ range: string; values: any[][] }> = [];
  let count = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const rowOpe = toStr(row[colOpe]);
    if (rowOpe !== ope) continue;

    const sheetRow = i + 1; // porque header es fila 1
    // estado (colEstado) es letra? mejor escribir por letras directas:
    // pero como no sabemos si moviste columnas, usamos índices: armamos rangos individuales por celda usando A1 notation:
    // Convert idx->col letter:
    const colLetter = (n: number) => {
      let s = "";
      n += 1;
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };

    data.push({
      range: `SolicitudesProduccion!${colLetter(colEstado)}${sheetRow}:${colLetter(colEstado)}${sheetRow}`,
      values: [["En cola"]],
    });
    data.push({
      range: `SolicitudesProduccion!${colLetter(colFechaUlt)}${sheetRow}:${colLetter(colFechaUlt)}${sheetRow}`,
      values: [[now]],
    });
    data.push({
      range: `SolicitudesProduccion!${colLetter(colUsuario)}${sheetRow}:${colLetter(colUsuario)}${sheetRow}`,
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
    const linea = toStr(body.linea) as Linea;
    const usuario = toStr(body.usuario) || "planeacion";
    const mode = body?.prioridad?.mode || "final";
    const posReq = toNum(body?.prioridad?.pos);

    if (!ope) return NextResponse.json({ success: false, message: "ope requerido" }, { status: 400 });
    if (!LINEAS.includes(linea))
      return NextResponse.json({ success: false, message: "linea inválida" }, { status: 400 });

    const sheets = await getSheetsClient();
    const SHEET = "ColaProduccion";
    await ensureSheet(sheets, SHEET);

    const all = await readColaRows(sheets);

    // Si ya existe esa OPE en alguna cola, no la duplicamos
    const exists = all.some((r) => r.ope === ope && (r.estado || "").toLowerCase() !== "finalizado");
    if (exists) {
      return NextResponse.json(
        { success: false, message: `La OPE ${ope} ya está en cola o programada.` },
        { status: 400 }
      );
    }

    const colaLinea = all.filter((r) => r.linea === linea).sort((a, b) => a.pos - b.pos);

    // calcular insertPos
    let insertPos = 1;
    if (mode === "inicio") insertPos = 1;
    else if (mode === "final") insertPos = colaLinea.length + 1;
    else insertPos = Math.min(Math.max(2, Math.floor(posReq) + 1 || 2), colaLinea.length + 1);

    // Shift: todos con pos >= insertPos suman +1
    const toShift = colaLinea.filter((r) => r.pos >= insertPos);

    // actualizamos sus posiciones en hoja
    if (toShift.length) {
      const data: Array<{ range: string; values: any[][] }> = [];
      for (const r of toShift) {
        const newPos = r.pos + 1;
        data.push({
          range: `${SHEET}!B${r.rowNumber}:B${r.rowNumber}`,
          values: [[newPos]],
        });
      }
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data },
      });
    }

    // append nuevo
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `${SHEET}!A:F`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[linea, insertPos, ope, "En cola", now, usuario]],
      },
    });

    // ✅ actualizar SolicitudesProduccion a "En cola"
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

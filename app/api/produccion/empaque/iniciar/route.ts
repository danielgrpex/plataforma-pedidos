// app/api/produccion/empaque/iniciar/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";

export const dynamic = "force-dynamic";

type Body = {
  trabajador: string;
  turno: string; // "A" | "B" | "C" | "N"
  ordenCorteItemId: string; // "OC-2025-00037 - 52"
  observaciones?: string;
};

function envOrThrow(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function getPrivateKey() {
  // En Vercel suele venir con \n escapado
  return envOrThrow("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function uid() {
  return crypto.randomUUID();
}

function parseOrdenCorteId(ordenCorteItemId: string) {
  // Esperado: "OC-2025-00037 - 52"
  const parts = ordenCorteItemId.split("-").map((s) => s.trim());
  // Mejor: split por " - "
  const byDash = ordenCorteItemId.split(" - ");
  return (byDash[0] || parts.slice(0, 4).join("-") || ordenCorteItemId).trim();
}

async function getSheets() {
  const auth = new google.auth.JWT({
    email: envOrThrow("GOOGLE_CLIENT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function getHeaderMap(sheets: any, spreadsheetId: string, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headerRow: string[] = (res.data.values?.[0] as string[]) || [];
  const map = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    map.set(String(h || "").trim(), idx);
  });
  return { headerRow, map };
}

function setCell(row: any[], headerMap: Map<string, number>, header: string, value: any) {
  const idx = headerMap.get(header);
  if (idx === undefined) return; // si no existe esa columna, no rompe
  row[idx] = value;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const trabajador = (body.trabajador || "").trim();
    const turno = (body.turno || "").trim();
    const ordenCorteItemId = (body.ordenCorteItemId || "").trim();
    const observaciones = (body.observaciones || "").trim();

    if (!trabajador) return NextResponse.json({ success: false, message: "Falta trabajador" }, { status: 400 });
    if (!turno) return NextResponse.json({ success: false, message: "Falta turno" }, { status: 400 });
    if (!ordenCorteItemId)
      return NextResponse.json({ success: false, message: "Falta ordenCorteItemId" }, { status: 400 });

    const spreadsheetId = envOrThrow("SHEET_BASE_PRINCIPAL_ID");
    const sheetName = "Corte_Actividades";

    const sheets = await getSheets();

    // Leer headers para mapear por nombre (robusto)
    const { headerRow, map } = await getHeaderMap(sheets, spreadsheetId, sheetName);
    if (headerRow.length === 0) {
      return NextResponse.json(
        { success: false, message: "No pude leer encabezados de Corte_Actividades (fila 1)" },
        { status: 500 }
      );
    }

    const actividadId = uid();
    const ordenCorteId = parseOrdenCorteId(ordenCorteItemId);

    // ISO (lo que necesitamos para que NO salga Invalid Date)
    const horaInicioISO = new Date().toISOString();

    // Construimos fila del tamaño del header
    const row = new Array(headerRow.length).fill("");

    // Columnas EXACTAS que me diste:
    // actividadId	ordenCorteId	ordenCorteItemId	Trabajador	Hora Inicio	turno	actividad (multi)
    // unidadesHechas	desperdicioUnd	desperdicioKg	Hora Fin	observaciones	estado (En curso / Finalizada)
    setCell(row, map, "actividadId", actividadId);
    setCell(row, map, "ordenCorteId", ordenCorteId);
    setCell(row, map, "ordenCorteItemId", ordenCorteItemId);
    setCell(row, map, "Trabajador", trabajador);
    setCell(row, map, "Hora Inicio", horaInicioISO);
    setCell(row, map, "turno", turno);
    setCell(row, map, "actividad (multi)", ""); // se llena en /finalizar
    setCell(row, map, "unidadesHechas", ""); // se llena en /finalizar
    setCell(row, map, "desperdicioUnd", ""); // se llena en /finalizar
    setCell(row, map, "desperdicioKg", ""); // se llena en /finalizar
    setCell(row, map, "Hora Fin", ""); // se llena en /finalizar
    setCell(row, map, "observaciones", observaciones || "");
    setCell(row, map, "estado (En curso / Finalizada)", "En curso");

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return NextResponse.json({
      success: true,
      actividadId,
      ordenCorteId,
      ordenCorteItemId,
      trabajador,
      turno,
      horaInicioISO,
      estado: "En curso",
    });
  } catch (err: any) {
    console.error("❌ /empaque/iniciar ERROR:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error iniciando actividad" },
      { status: 500 }
    );
  }
}

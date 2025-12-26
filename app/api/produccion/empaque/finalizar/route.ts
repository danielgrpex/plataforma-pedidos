// app/api/produccion/empaque/finalizar/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Turno = "A" | "B" | "C" | "N";

type FinalizarBody = {
  actividadId: string;

  trabajador: string;
  turno: Turno;

  actividades: string[]; // multi
  unidadesHechas: number;
  desperdicioUnd: number;
  desperdicioKg: number;

  observaciones?: string;
};

const SHEET_NAME = "Corte_Actividades";

// Columnas A..M (1..13)
const COLS = {
  actividadId: 1, // A
  ordenCorteId: 2, // B
  ordenCorteItemId: 3, // C
  trabajador: 4, // D
  horaInicio: 5, // E
  turno: 6, // F
  actividadMulti: 7, // G
  unidadesHechas: 8, // H
  desperdicioUnd: 9, // I
  desperdicioKg: 10, // J
  horaFin: 11, // K
  observaciones: 12, // L
  estado: 13, // M
};

function colToA1(col: number) {
  // 1 -> A, 2 -> B ...
  let n = col;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function nowISO() {
  return new Date().toISOString();
}

function safeNum(x: any) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

async function getSheetsClient() {
  const clientEmail = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FinalizarBody;

    const actividadId = String(body.actividadId || "").trim();
    const trabajador = String(body.trabajador || "").trim();
    const turno = String(body.turno || "").trim() as Turno;

    const actividades = Array.isArray(body.actividades) ? body.actividades : [];
    const unidadesHechas = safeNum(body.unidadesHechas);
    const desperdicioUnd = safeNum(body.desperdicioUnd);
    const desperdicioKg = safeNum(body.desperdicioKg);
    const observaciones = String(body.observaciones || "").trim();

    if (!actividadId) {
      return NextResponse.json({ success: false, message: "Falta actividadId" }, { status: 400 });
    }
    if (!trabajador) {
      return NextResponse.json({ success: false, message: "Falta trabajador" }, { status: 400 });
    }
    if (!turno || !["A", "B", "C", "N"].includes(turno)) {
      return NextResponse.json({ success: false, message: "Turno inválido" }, { status: 400 });
    }
    if (!actividades.length) {
      return NextResponse.json({ success: false, message: "Selecciona al menos 1 actividad" }, { status: 400 });
    }
    if (unidadesHechas <= 0) {
      return NextResponse.json({ success: false, message: "Unidades hechas debe ser > 0" }, { status: 400 });
    }

    const spreadsheetId = getEnv("SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheetsClient();

    // Traemos toda la tabla (A:M) para ubicar la fila por actividadId
    const getResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:M`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = (getResp.data.values || []) as any[][];
    if (rows.length <= 1) {
      return NextResponse.json(
        { success: false, message: "La hoja Corte_Actividades está vacía." },
        { status: 404 }
      );
    }

    // Buscar fila (saltando header)
    let foundRowIndex = -1; // índice 0-based dentro de 'rows'
    for (let i = 1; i < rows.length; i++) {
      const cellActividadId = String(rows[i]?.[COLS.actividadId - 1] ?? "").trim();
      if (cellActividadId === actividadId) {
        foundRowIndex = i;
        break;
      }
    }

    if (foundRowIndex === -1) {
      return NextResponse.json(
        { success: false, message: `No encontré actividadId ${actividadId} en Corte_Actividades` },
        { status: 404 }
      );
    }

    // Validar que esté En curso (opcional pero recomendado)
    const estadoActual = String(rows[foundRowIndex]?.[COLS.estado - 1] ?? "").trim().toLowerCase();
    if (estadoActual && estadoActual !== "en curso") {
      return NextResponse.json(
        { success: false, message: "Esta actividad no está En curso (puede estar ya finalizada)." },
        { status: 400 }
      );
    }

    const horaFinISO = nowISO();
    const actividadesStr = actividades.join("|"); // multi en una celda

    // Vamos a actualizar F..M en esa fila (turno -> estado)
    const rowNumber = foundRowIndex + 1; // a Sheets es 1-based
    const startCol = COLS.turno; // F
    const endCol = COLS.estado; // M

    const rangeA1 = `${SHEET_NAME}!${colToA1(startCol)}${rowNumber}:${colToA1(endCol)}${rowNumber}`;

    const values = [
      [
        turno, // F
        actividadesStr, // G
        unidadesHechas, // H
        desperdicioUnd, // I
        desperdicioKg, // J
        horaFinISO, // K
        observaciones, // L
        "Finalizada", // M
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rangeA1,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    return NextResponse.json({
      success: true,
      actividadId,
      horaFinISO,
      estado: "Finalizada",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Error finalizando actividad" },
      { status: 500 }
    );
  }
}

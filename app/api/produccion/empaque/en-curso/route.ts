import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Corte_Actividades";

/**
 * Lee Corte_Actividades y devuelve solo estado "En curso"
 * Columnas:
 * A actividadId
 * B ordenCorteId
 * C ordenCorteItemId
 * D Trabajador
 * E Hora Inicio
 * F turno
 * ...
 * M estado (En curso / Finalizada)
 */
export async function GET() {
  try {
    const spreadsheetId = process.env.SHEET_BASE_PRINCIPAL_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Falta GOOGLE_SHEETS_ID en .env" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const range = `${SHEET_NAME}!A2:M`;
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = (resp.data.values || []) as string[][];

    const items = rows
      .map((r) => ({
        actividadId: r[0] || "",
        ordenCorteId: r[1] || "",
        ordenCorteItemId: r[2] || "",
        trabajador: r[3] || "",
        horaInicioISO: r[4] || "",
        turno: (r[5] || "A") as any,
        estado: (r[12] || "").trim() as any,
      }))
      .filter((x) => x.actividadId && x.estado === "En curso")
      .map((x) => ({
        ...x,
        // normaliza turno a A/B/C/N si llega "Turno B"
        turno: String(x.turno).replace("Turno ", "").replace("Noche", "N") as any,
      }));

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Error listando en-curso" },
      { status: 500 }
    );
  }
}

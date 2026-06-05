import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_ID = process.env.SHEET_INFO_ID!;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getColumnValues(
  sheets: any,
  sheetName: string,
  column: string = "A"
) {
  const range = `${sheetName}!${column}2:${column}`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  return (response.data.values || [])
    .map((row: any[]) => String(row?.[0] ?? "").trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    const client = await auth.getClient();

    const sheets = google.sheets({
      version: "v4",
      auth: client as any,
    });

    const [paros, supervisores] = await Promise.all([
      getColumnValues(sheets, "Paros"),
      getColumnValues(sheets, "Supervisores"),
    ]);

    return NextResponse.json(
      {
        ok: true,
        data: {
          paros,
          supervisores,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Error cargando catálogos reporte máquinas:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron cargar los catálogos de reporte máquinas",
      },
      { status: 500 }
    );
  }
}
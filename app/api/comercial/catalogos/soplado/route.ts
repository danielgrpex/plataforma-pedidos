import { google } from "googleapis";
import { NextResponse } from "next/server";

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
    .map((row: any[]) => row[0])
    .filter(Boolean);
}

async function getSiigoSopladoValues(sheets: any) {
  const range = `Siigo.Soplado!A2:B`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  return (response.data.values || [])
    .map((row: any[]) => {
      const codigo = String(row?.[0] ?? "").trim();
      const nombre = String(row?.[1] ?? "").trim();

      if (!codigo && !nombre) return null;
      if (codigo && nombre) return `${codigo} - ${nombre}`;
      return codigo || nombre;
    })
    .filter(Boolean);
}

export async function GET() {
  try {
    const client = await auth.getClient();

    const sheets = google.sheets({
      version: "v4",
      auth: client as any,
    });

    const [
      clientes,
      siigo,
      referencias,
      materialColor,
      bocas,
      acabados,
      vendedores,
    ] = await Promise.all([
      getColumnValues(sheets, "Clientes.Soplado"),
      getSiigoSopladoValues(sheets),
      getColumnValues(sheets, "Ref.Soplado"),
      getColumnValues(sheets, "M.Color.Soplado"),
      getColumnValues(sheets, "Boca.Soplado"),
      getColumnValues(sheets, "Acabados.Soplado"),
      getColumnValues(sheets, "Vendedores"),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        clientes,
        siigo,
        referencias,
        materialColor,
        bocas,
        acabados,
        vendedores,
      },
    });
  } catch (error) {
    console.error("Error cargando catálogos soplado:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron cargar los catálogos de soplado",
      },
      { status: 500 }
    );
  }
}
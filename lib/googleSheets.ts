// lib/googleSheets.ts
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey) {
    console.error("[GoogleSheets] Falta GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY");
    throw new Error("Faltan credenciales de Google en variables de entorno");
  }

  // En .env y en Vercel la clave viene con \n escapados
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient();
  }
  return sheetsClient;
}

// 👇 OJO: aquí dejamos el fallback del ID de Información
export async function getInfoSheetRange(range: string) {
  const spreadsheetId =
    process.env.SHEET_INFO_ID ||
    process.env.GOOGLE_SHEETS_PEDIDOS_ID ||
    "1fPUjHKyDxTSPpTYIXyUHSAO1KyM2-4C-GE6kTsIc0WY"; // Fallback seguro

  if (!spreadsheetId) {
    console.error("[GoogleSheets] SHEET_INFO_ID no está definido en runtime");
    throw new Error("Falta SHEET_INFO_ID en .env.local");
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

export async function getBasePrincipalRange(range: string) {
  const spreadsheetId = process.env.SHEET_BASE_PRINCIPAL_ID;
  if (!spreadsheetId) {
    throw new Error("Falta SHEET_BASE_PRINCIPAL_ID en .env.local");
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

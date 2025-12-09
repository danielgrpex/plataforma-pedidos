// lib/googleSheets.ts
import path from "path";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  const keyFile = path.join(process.cwd(), "service-account.json");

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: SCOPES,
  });

  const authClient = (await auth.getClient()) as any;

  return google.sheets({
    version: "v4",
    auth: authClient,
  });
}

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient();
  }
  return sheetsClient;
}

export async function getInfoSheetRange(range: string) {
  const spreadsheetId = process.env.SHEET_INFO_ID;
  if (!spreadsheetId) {
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

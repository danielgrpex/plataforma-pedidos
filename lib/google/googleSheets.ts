// lib/google/googleSheets.ts
import path from "path";
import { google } from "googleapis";
import { env } from "@/lib/config/env";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  // ✅ En local intentamos usar service-account.json
  if (process.env.NODE_ENV !== "production") {
    try {
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
    } catch (err) {
      console.warn(
        "[GoogleSheets] No se encontró service-account.json, usando credenciales de env.ts",
        err
      );
    }
  }

  // ✅ En Vercel (o si falla el JSON en local) usamos las vars de entorno centralizadas
  const jwtClient = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: SCOPES,
  });

  return google.sheets({
    version: "v4",
    auth: jwtClient,
  });
}

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient();
  }
  return sheetsClient;
}

// 👇 ID por defecto de la hoja "Información" (no es secreto)
const INFO_SHEET_ID_FALLBACK = "1fPUjHKyDxTSPpTYIXyUHSAO1KyM2-4C-GE6kTsIc0WY";

/**
 * Lee rangos de la hoja "Información" (catálogos)
 */
export async function getInfoSheetRange(range: string) {
  const spreadsheetId =
    env.SHEET_INFO_ID || env.SHEET_BASE_PRINCIPAL_ID || INFO_SHEET_ID_FALLBACK;

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

/**
 * Lee rangos de la hoja "Base Principal"
 */
export async function getBasePrincipalRange(range: string) {
  const spreadsheetId = env.SHEET_BASE_PRINCIPAL_ID;

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

/**
 * Agrega filas al final de la hoja "Base Principal" (tab: pedidos)
 */
export async function appendBasePrincipalRows(rows: string[][]) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: "Pedidos!A:AK", // ✅ 37 columnas (A..AK) y pestaña "Pedidos"
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}


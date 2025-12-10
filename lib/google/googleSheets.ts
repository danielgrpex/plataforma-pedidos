// lib/google/googleSheets.ts
import path from "path";
import { google } from "googleapis";
import { env } from "@/lib/config/env";
import { getGoogleAuthClient } from "./googleClient";

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  // 🔹 En modo local usamos service-account.json si existe
  if (process.env.NODE_ENV !== "production") {
    try {
      const keyFile = path.join(process.cwd(), "service-account.json");
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await auth.getClient();
      return google.sheets({ version: "v4", auth: authClient });
    } catch (err) {
      console.warn("[GoogleSheets] No se encontró service-account.json, usando env.ts");
    }
  }

  // 🔹 En producción (o fallback local), usamos credenciales desde env.ts
  const authClient = await getGoogleAuthClient();
  return google.sheets({ version: "v4", auth: authClient });
}

export async function getSheetsClient() {
  if (!sheetsClient) sheetsClient = await createSheetsClient();
  return sheetsClient;
}

/**
 * Lee rangos de la hoja "Información"
 */
export async function getInfoSheetRange(range: string) {
  const spreadsheetId = env.SHEET_INFO_ID;

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

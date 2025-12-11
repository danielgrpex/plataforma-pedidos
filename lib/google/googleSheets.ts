// lib/google/googleSheets.ts
import path from "path";
import { google } from "googleapis";
import { env } from "@/lib/config/env";
import { getGoogleAuthClient } from "./googleClient";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  // 🔹 En modo local intentamos usar service-account.json
  if (process.env.NODE_ENV !== "production") {
    try {
      const keyFile = path.join(process.cwd(), "service-account.json");
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: SCOPES,
      });

      const authClient = await auth.getClient();
      return google.sheets({ version: "v4", auth: authClient as any });
    } catch (err) {
      console.warn(
        "[GoogleSheets] No se encontró service-account.json, usando credenciales de env.ts"
      );
    }
  }

  // 🔹 En producción (y como fallback local), usamos getGoogleAuthClient()
  const authClient = await getGoogleAuthClient();
  return google.sheets({ version: "v4", auth: authClient as any });
}

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient();
  }
  return sheetsClient;
}

/* ------------------------------------------------------------------ */
/*  Helpers genéricos                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lee un rango de cualquier hoja de cálculo.
 */
export async function readSheetRange(spreadsheetId: string, range: string) {
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

/**
 * Agrega filas al final de un rango (append).
 */
export async function appendSheetRows(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });

  return res.data;
}

/* ------------------------------------------------------------------ */
/*  Helpers específicos de tu proyecto                                */
/* ------------------------------------------------------------------ */

/**
 * Lee rangos de la hoja "Información" (catálogos).
 * Compatibilidad con código existente.
 */
export async function getInfoSheetRange(range: string) {
  return readSheetRange(env.SHEET_INFO_ID, range);
}

/**
 * Lee rangos de la hoja "Base Principal".
 * Compatibilidad con código existente.
 */
export async function getBasePrincipalRange(range: string) {
  return readSheetRange(env.SHEET_BASE_PRINCIPAL_ID, range);
}

/**
 * Agrega filas a la "Base Principal" (donde se guardan los pedidos).
 * Esto lo usaremos para guardar pedidos completos.
 */
export async function appendBasePrincipalRows(
  range: string,
  values: any[][]
) {
  return appendSheetRows(env.SHEET_BASE_PRINCIPAL_ID, range, values);
}

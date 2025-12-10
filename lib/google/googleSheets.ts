// lib/googleSheets.ts
import path from "path";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function createSheetsClient() {
  if (process.env.NODE_ENV !== "production") {
    // local -> service-account.json
    const keyFile = path.join(process.cwd(), "service-account.json");
    const auth = new google.auth.GoogleAuth({ keyFile, scopes: SCOPES });
    const authClient = (await auth.getClient()) as any;
    return google.sheets({ version: "v4", auth: authClient });
  }

  // 🚨 DEBUG EN PRODUCCIÓN
  console.log(
    "[GoogleSheets][prod debug]",
    "NODE_ENV:", process.env.NODE_ENV,
    "GOOGLE_CLIENT_EMAIL:", process.env.GOOGLE_CLIENT_EMAIL || "<undefined>",
    "KEY length:", process.env.GOOGLE_PRIVATE_KEY
      ? String(process.env.GOOGLE_PRIVATE_KEY).length
      : 0
  );

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey) {
    console.error("[GoogleSheets] Falta GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY");
    throw new Error("Faltan credenciales de Google en variables de entorno");
  }

  const privateKey = rawPrivateKey.includes("\\n")
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : rawPrivateKey;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth });
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
    process.env.SHEET_INFO_ID ||
    process.env.GOOGLE_SHEETS_PEDIDOS_ID ||
    INFO_SHEET_ID_FALLBACK;

  if (!spreadsheetId) {
    console.error("[GoogleSheets] SHEET_INFO_ID no está definido");
    throw new Error("Falta SHEET_INFO_ID en configuración");
  }

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
  const spreadsheetId =
    process.env.SHEET_BASE_PRINCIPAL_ID ||
    process.env.GOOGLE_SHEETS_PEDIDOS_BASE_ID;

  if (!spreadsheetId) {
    throw new Error("Falta SHEET_BASE_PRINCIPAL_ID en configuración");
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}

// lib/googleClient.ts
import { google } from "googleapis";

export function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  if (!clientEmail || !privateKey) {
    throw new Error("Faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY");
  }

  // Si la clave viene con "\n" escapados, los convertimos en saltos reales.
  privateKey = privateKey.replace(/\\n/g, "\n");

  // Log de depuración (solo en local)
  console.log("[GoogleAuth] usando clientEmail:", clientEmail);

  const auth = new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ]
  );

  return auth;
}

export function getSheets() {
  const auth = getGoogleAuth();
  return google.sheets({ version: "v4", auth });
}

export function getDrive() {
  const auth = getGoogleAuth();
  return google.drive({ version: "v3", auth });
}

export const PEDIDOS_SHEET_ID = process.env.GOOGLE_SHEETS_PEDIDOS_ID!;
export const SHEET_PEDIDOS = "Pedidos";
export const SHEET_CONFIG = "Config";

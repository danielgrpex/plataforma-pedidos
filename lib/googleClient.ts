// lib/googleClient.ts
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

let authClient: any | null = null;

/**
 * Devuelve un cliente de autenticación de Google reutilizable.
 * Usa las variables de entorno GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY.
 */
export async function getGoogleAuthClient() {
  if (authClient) return authClient;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      "Faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY en variables de entorno"
    );
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  authClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  return authClient;
}

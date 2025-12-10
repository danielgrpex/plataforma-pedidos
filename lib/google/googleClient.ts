// lib/google/googleClient.ts
import { google } from "googleapis";
import { env } from "@/lib/config/env";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

let authClient: any | null = null;

/**
 * Devuelve un cliente de autenticación de Google reutilizable.
 * Usa las variables ya validadas en env.ts
 */
export async function getGoogleAuthClient() {
  if (authClient) return authClient;

  authClient = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: SCOPES,
  });

  return authClient;
}

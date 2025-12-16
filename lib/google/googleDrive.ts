// lib/google/googleDrive.ts
import { google } from "googleapis";
import { env } from "@/lib/config/env";
import { Readable } from "stream";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

type DriveFolder = {
  id: string;
  webViewLink?: string;
};

function getDriveClient(accessToken?: string) {
  // Si llega token -> OAuth (Drive del usuario)
  if (accessToken) {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });

    return google.drive({
      version: "v3",
      auth: oauth2,
    });
  }

  // Si NO llega token -> Service Account (para carpetas)
  const jwt = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: DRIVE_SCOPES,
  });

  return google.drive({
    version: "v3",
    auth: jwt,
  });
}

/**
 * Crea carpeta en Drive.
 * - Sin accessToken: Service Account
 * - Con accessToken: OAuth
 */
export async function createFolder(
  name: string,
  parentId: string,
  accessToken?: string
): Promise<DriveFolder> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error("No se pudo crear la carpeta (sin id).");

  return {
    id,
    webViewLink: res.data.webViewLink ?? undefined,
  };
}

/**
 * Sube PDF a una carpeta.
 * OJO: Para subir al Drive del usuario normalmente debes pasar accessToken (OAuth).
 */
export async function uploadPdfToFolder(
  folderId: string,
  fileName: string,
  pdfDataUrl: string,
  accessToken?: string
) {
  const drive = getDriveClient(accessToken);

  // data:image/pdf;base64,....
  const base64 = pdfDataUrl.includes("base64,")
    ? pdfDataUrl.split("base64,")[1]
    : pdfDataUrl;

  const buffer = Buffer.from(base64, "base64");

  // ✅ Esto arregla el error: part.body.pipe is not a function
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: stream,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!res.data.id) throw new Error("No se pudo subir el PDF (sin id).");

  return res.data;
}

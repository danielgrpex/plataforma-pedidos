// lib/google/googleDrive.ts
import { google } from "googleapis";
import { env } from "@/lib/config/env";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let driveClient: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: SCOPES,
  });

  driveClient = google.drive({
    version: "v3",
    auth,
  });

  return driveClient;
}

/**
 * Crea carpeta si no existe y devuelve su ID
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = await getDriveClient();

  // Buscar si ya existe
  const qParts = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const search = await drive.files.list({
    q: qParts.join(" and "),
    fields: "files(id, webViewLink)",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0] as any;
  }

  // Crear carpeta
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, webViewLink",
  });

  return res.data as any;
}

/**
 * Sube PDF a una carpeta
 */
export async function uploadPdfToFolder(
  folderId: string,
  fileName: string,
  base64Data: string
) {
  const drive = await getDriveClient();

  const buffer = Buffer.from(
    base64Data.replace(/^data:application\/pdf;base64,/, ""),
    "base64"
  );

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: buffer,
    },
    fields: "id, webViewLink",
  });

  return res.data;
}

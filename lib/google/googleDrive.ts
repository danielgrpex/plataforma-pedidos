// lib/google/googleDrive.ts
import path from "path";
import { google } from "googleapis";
import { env } from "@/lib/config/env";
import { Readable } from "stream";
const SCOPES = ["https://www.googleapis.com/auth/drive"];

let driveClient: ReturnType<typeof google.drive> | null = null;

async function createDriveClient() {
  // ✅ En local intentamos usar service-account.json
  if (process.env.NODE_ENV !== "production") {
    try {
      const keyFile = path.join(process.cwd(), "service-account.json");
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: SCOPES,
      });
      const authClient = (await auth.getClient()) as any;

      return google.drive({
        version: "v3",
        auth: authClient,
      });
    } catch (err) {
      console.warn(
        "[GoogleDrive] No se encontró service-account.json, usando credenciales de env.ts",
        err
      );
    }
  }

  // ✅ En Vercel (o si falla el JSON en local) usamos vars de entorno
  const jwtClient = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: SCOPES,
  });

  return google.drive({
    version: "v3",
    auth: jwtClient,
  });
}

export async function getDriveClient() {
  if (!driveClient) {
    driveClient = await createDriveClient();
  }
  return driveClient;
}

function escapeQueryString(s: string) {
  return s.replace(/'/g, "\\'");
}

export type DriveFolderRef = {
  id: string;
  webViewLink: string;
};

export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFolderRef> {
  const drive = await getDriveClient();

  const qParts = [
    `name='${escapeQueryString(name)}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const search = await drive.files.list({
    q: qParts.join(" and "),
    fields: "files(id, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = search.data.files?.[0];
  if (existing?.id && existing.webViewLink) {
    return { id: existing.id, webViewLink: existing.webViewLink };
  }

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const id = res.data.id ?? "";
  const webViewLink = res.data.webViewLink ?? "";

  if (!id) throw new Error("Drive: no se pudo crear/obtener el ID de la carpeta.");
  if (!webViewLink)
    throw new Error("Drive: no se pudo obtener el webViewLink de la carpeta.");

  return { id, webViewLink };
}

export type DriveFileRef = {
  id?: string;
  webViewLink?: string;
};

export async function uploadPdfToFolder(
  folderId: string,
  fileName: string,
  dataUrl: string
): Promise<{ id?: string; webViewLink?: string }> {
  const drive = await getDriveClient();

  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer), // ✅ stream
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id ?? undefined,
    webViewLink: res.data.webViewLink ?? undefined,
  };
}
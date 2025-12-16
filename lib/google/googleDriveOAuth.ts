import { google } from "googleapis";
import { Readable } from "stream";

function driveClient(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

export async function createFolderOAuth(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = driveClient(accessToken);

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, webViewLink",
  });

  if (!res.data.id || !res.data.webViewLink) {
    throw new Error("No se pudo crear la carpeta en Drive.");
  }

  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

export async function uploadPdfOAuth(
  accessToken: string,
  folderId: string,
  fileName: string,
  dataUrl: string
) {
  const drive = driveClient(accessToken);

  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  return drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });
}

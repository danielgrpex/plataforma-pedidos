import { google } from "googleapis";

/**
 * Exporta un rango de una spreadsheet a PDF usando Drive export.
 * OJO: ranges en export no siempre funciona con Drive export directo.
 * Lo más estable es: exportar el spreadsheet completo, pero forzar "gid" (hoja)
 * y usar que la hoja ya esté configurada para imprimir ese rango (B2:T57).
 *
 * Solución robusta:
 * - Duplicas la hoja plantilla
 * - La configuras (opcional) para print range B2:T57 (si ya está)
 * - Exportas por gid
 */
export async function exportSheetToPdfByGid(params: {
  auth: any;
  spreadsheetId: string;
  sheetGid: number;
}) {
  const { auth, spreadsheetId, sheetGid } = params;

  // Drive export (PDF)
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: "application/pdf",
    },
    { responseType: "arraybuffer" }
  );

  // ⚠️ Drive export exporta TODO el spreadsheet.
  // Para que salga SOLO B2:T57:
  // debes exportar la hoja (gid) con configuración de impresión ya definida en la plantilla.
  // El truco: usar "printsettings" dentro del spreadsheet o usar "export?gid=xxx".
  // Como googleapis no soporta esos params directo, usamos fetch con access token abajo.

  return Buffer.from(res.data as any);
}

/**
 * Exporta con URL directa usando parámetros de export de Google Sheets
 * (esto sí permite gid + rango ya configurado).
 */
export async function exportGoogleSheetsPdfViaHttp(params: {
  authClient: any;
  spreadsheetId: string;
  gid: number;
}) {
  const { authClient, spreadsheetId, gid } = params;

  const tokenResp = await authClient.getAccessToken();
  const token = typeof tokenResp === "string" ? tokenResp : tokenResp?.token;

  if (!token) throw new Error("No pude obtener access token de Google");

  // Export URL de Google Sheets (más flexible que Drive API)
  // gid = hoja específica
  // portrait=false => horizontal
  // fitw=true => ajustar al ancho
  // sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false => limpio
  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export` +
    `?format=pdf` +
    `&gid=${gid}` +
    `&portrait=false` +
    `&fitw=true` +
    `&scale=4` + // 4 = fit to width; puedes ajustar
    `&top_margin=0.2&bottom_margin=0.2&left_margin=0.2&right_margin=0.2` +
    `&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Error exportando PDF desde Google Sheets: ${resp.status} ${t}`);
  }

  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

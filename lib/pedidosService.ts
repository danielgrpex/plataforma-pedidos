// lib/pedidosService.ts
import {
  getDrive,
  getSheets,
  PEDIDOS_SHEET_ID,
  SHEET_PEDIDOS,
} from "./googleClient";
import { getConfig } from "./pedidosConfig";

type CabeceraPayload = {
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  asesor: string;
  obs?: string;
  fechaSolicitud?: string;
  esAdicional?: boolean;
};

type ItemPayload = {
  referencia: string;
  color: string;
  ancho: string | number;
  largo: string | number;
  cantidad: string | number;
  acabados?: string[];
  precioUnitario: string | number;
};

type FilesPayload = {
  ocPdf: { name: string; dataUrl: string };
};

export type PedidoPayload = {
  cabecera: CabeceraPayload;
  items: ItemPayload[];
  files: FilesPayload;
  createdByEmail: string;
};

// ===== DRIVE =====

async function crearCarpetaPedido_(
  rootId: string,
  oc: string
): Promise<{ pedidoFolderId: string; ocFolderId: string }> {
  const drive = getDrive();

  const pedidoRes = await drive.files.create({
    requestBody: {
      name: String(oc).trim(),
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    },
    fields: "id",
  });

  const pedidoFolderId = pedidoRes.data.id!;
  const ocRes = await drive.files.create({
    requestBody: {
      name: "01_OC",
      mimeType: "application/vnd.google-apps.folder",
      parents: [pedidoFolderId],
    },
    fields: "id",
  });

  return { pedidoFolderId, ocFolderId: ocRes.data.id! };
}

async function subirArchivoBase64_(
  parentFolderId: string,
  dataUrl: string,
  fileName: string
): Promise<{ id: string; url: string; name: string }> {
  const drive = getDrive();

  const [meta, base64] = dataUrl.split(",");
  const match = /data:(.*?);base64/.exec(meta || "");
  const mimeType = match?.[1] || "application/pdf";

  const buffer = Buffer.from(base64, "base64");

  const res = await drive.files.create({
    requestBody: {
      name: fileName || "OC.pdf",
      parents: [parentFolderId],
      mimeType,
    },
    media: {
      mimeType,
      body: buffer,
    },
    fields: "id, name, webViewLink, webContentLink",
  });

  const id = res.data.id!;
  const url =
    res.data.webViewLink ||
    `https://drive.google.com/file/d/${id}/view?usp=drivesdk`;

  return { id, url, name: res.data.name || fileName };
}

// ===== SHEETS HELPERS =====

async function getPedidosData() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PEDIDOS_SHEET_ID,
    range: `${SHEET_PEDIDOS}!A:AZ`,
  });

  const values = res.data.values || [];
  const headers = values[0] || [];
  const rows = values.slice(1);

  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[String(h)] = i;
  });

  return { headers, rows, idx };
}

function extractFolderIdFromLink(url: string): string | null {
  const m = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}

async function ocExistePorCliente(
  oc: string,
  cliente: string
): Promise<boolean> {
  const { rows, idx } = await getPedidosData();

  const iOC = idx["Orden de Compra"];
  const iCli = idx["Cliente"];
  if (iOC == null || iCli == null) return false;

  const targetOC = String(oc || "").trim().toUpperCase();
  const targetCli = String(cliente || "").trim().toUpperCase();

  return rows.some((r) => {
    const ocV = String(r[iOC] || "").trim().toUpperCase();
    const cliV = String(r[iCli] || "").trim().toUpperCase();
    return ocV === targetOC && cliV === targetCli;
  });
}

async function getExistingFolderIdForOCCliente(
  oc: string,
  cliente: string
): Promise<string | null> {
  const { rows, idx } = await getPedidosData();
  const iOC = idx["Orden de Compra"];
  const iCli = idx["Cliente"];
  const iLink = idx["drive_folder_link"];

  if (iOC == null || iCli == null || iLink == null) return null;

  const targetOC = String(oc || "").trim().toUpperCase();
  const targetCli = String(cliente || "").trim().toUpperCase();

  for (const r of rows) {
    const ocV = String(r[iOC] || "").trim().toUpperCase();
    const cliV = String(r[iCli] || "").trim().toUpperCase();
    if (ocV === targetOC && cliV === targetCli) {
      const url = String(r[iLink] || "");
      return extractFolderIdFromLink(url);
    }
  }
  return null;
}

// ===== LÓGICA PRINCIPAL =====

async function guardarPedidoNode(payload: PedidoPayload) {
  const { drive_root_folder_id, estado_inicial } = await getConfig();

  const cab = payload.cabecera || ({} as CabeceraPayload);
  const req = (v: any) => String(v ?? "").trim().length > 0;

  // ==== VALIDACIONES CABECERA ====
  if (!req(cab.cliente)) throw new Error("Cliente es obligatorio");
  if (!req(cab.asesor)) throw new Error("Asesor comercial es obligatorio");
  if (!req(cab.direccion))
    throw new Error("Dirección de despacho es obligatoria");
  if (!req(cab.oc))
    throw new Error("N° Orden de Compra / Cotización es obligatorio");
  if (!req(cab.fechaRequerida))
    throw new Error("Fecha requerida de entrega es obligatoria");
  if (!payload.files?.ocPdf?.dataUrl)
    throw new Error("Debes adjuntar el PDF de la OC/cotización");

  const esAdicional = !!cab.esAdicional;

  // ==== VALIDACIONES ITEMS ====
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("Debes agregar al menos un producto");

  if (!esAdicional && (await ocExistePorCliente(cab.oc, cab.cliente))) {
    throw new Error("El Nº de OC ya existe para este cliente: " + cab.oc);
  }

  items.forEach((it, i) => {
    const n = i + 1;
    const must = (v: any, msg: string) => {
      if (!req(v)) throw new Error(`${msg} en producto ${n}`);
    };
    must(it.referencia, "Referencia obligatoria");
    must(it.color, "Color obligatorio");
    must(it.ancho, "Ancho obligatorio");

    const largo = Number(it.largo);
    const cant = Number(it.cantidad);
    const precio = Number(it.precioUnitario);

    if (!(largo > 0))
      throw new Error(`Largo (m) debe ser > 0 en producto ${n}`);
    if (!(cant > 0))
      throw new Error(`Cantidad (und) debe ser > 0 en producto ${n}`);
    if (!(precio > 0))
      throw new Error(`Precio unitario debe ser > 0 en producto ${n}`);
  });

  // === Carpeta destino y PDF ===
  let pedidoFolderId: string;
  let ocFolderId: string;

  if (esAdicional) {
    const existing = await getExistingFolderIdForOCCliente(
      cab.oc,
      cab.cliente
    );
    if (existing) {
      pedidoFolderId = existing;
      ocFolderId = pedidoFolderId;
    } else {
      const ids = await crearCarpetaPedido_(drive_root_folder_id, cab.oc);
      pedidoFolderId = ids.pedidoFolderId;
      ocFolderId = ids.ocFolderId;
    }
  } else {
    const ids = await crearCarpetaPedido_(drive_root_folder_id, cab.oc);
    pedidoFolderId = ids.pedidoFolderId;
    ocFolderId = ids.ocFolderId;
  }

  const ocPdf = await subirArchivoBase64_(
    ocFolderId,
    payload.files.ocPdf.dataUrl,
    payload.files.ocPdf.name || `OC_${cab.oc}.pdf`
  );

  // === Construir filas para Sheets ===
  const sheets = getSheets();
  const { headers, rows, idx } = await getPedidosData();
  const now = new Date();

  const findCol = (names: string[]) => {
    for (const n of names) if (idx[n] != null) return idx[n];
    return null;
  };

  const colConsecutivo = idx["Consecutivo"];
  const colFechaSol = idx["Fecha de Solicitud"];
  const colAsesor = idx["Asesor Comercial"];
  const colCliente = idx["Cliente"];
  const colDir = idx["Dirección y ciudad de despacho"];
  const colOC = idx["Orden de Compra"];
  const colProducto = findCol(["Producto"]);
  const colProdKey = findCol(["ProductoKey", "ProductKey"]);
  const colRef = idx["Referencia"];
  const colColor = idx["Color"];
  const colAncho = idx["Ancho"];
  const colLargo = idx["Largo"];
  const colCantUnd = findCol(["Cantidad (und)", "Cantidad"]);
  const colCantM = findCol(["Cantidad (m)"]);
  const colAcabados = idx["Acabados"];
  const colPrecio = idx["Precio Unitario"];
  const colFechaReq = idx["Fecha Requerida Cliente"];
  const colObsCom = idx["Observaciones Comerciales"];
  const colEstado = idx["Estado"];
  const colDriveLink = idx["drive_folder_link"];
  const colPdfLink = idx["pdf_oc_link"];
  const colCreatedBy = idx["created_by"];
  const colCreatedAt = idx["created_at"];
  const colUpdatedAt = idx["updated_at"];

  const newRows: any[][] = [];

  items.forEach((it) => {
    const cant = Number(it.cantidad || 0);
    const ancho = Number(it.ancho || 0);
    const largo = Number(it.largo || 0);
    const metros = Number((cant * largo).toFixed(3));
    const acabadosArr = it.acabados || [];
    const acabadosText = acabadosArr.join(", ");

    const acabadosKey = acabadosArr.slice().sort().join("+") || "SINACAB";
    const productKey = [
      String(it.referencia || "").trim(),
      String(it.color || "").trim(),
      ancho,
      largo,
      acabadosKey,
    ].join("|");

    const row = new Array(headers.length).fill("");

    if (colFechaSol != null) row[colFechaSol] = cab.fechaSolicitud || now;
    if (colAsesor != null) row[colAsesor] = cab.asesor || payload.createdByEmail;
    if (colCliente != null) row[colCliente] = cab.cliente || "";
    if (colDir != null) row[colDir] = cab.direccion || "";
    if (colOC != null) row[colOC] = cab.oc;

    if (colProducto != null) row[colProducto] = productKey;
    if (colProdKey != null) row[colProdKey] = productKey;

    if (colRef != null) row[colRef] = it.referencia || "";
    if (colColor != null) row[colColor] = it.color || "";
    if (colAncho != null) row[colAncho] = ancho;
    if (colLargo != null) row[colLargo] = largo;
    if (colCantUnd != null) row[colCantUnd] = cant;
    if (colCantM != null) row[colCantM] = metros;
    if (colAcabados != null) row[colAcabados] = acabadosText;
    if (colPrecio != null) row[colPrecio] = Number(it.precioUnitario || 0);
    if (colFechaReq != null) row[colFechaReq] = cab.fechaRequerida || "";
    if (colObsCom != null) row[colObsCom] = cab.obs || "";
    if (colEstado != null) row[colEstado] = estado_inicial;

    if (colDriveLink != null)
      row[colDriveLink] =
        "https://drive.google.com/drive/folders/" + pedidoFolderId;
    if (colPdfLink != null) row[colPdfLink] = ocPdf.url;
    if (colCreatedBy != null) row[colCreatedBy] = payload.createdByEmail;
    if (colCreatedAt != null) row[colCreatedAt] = now;
    if (colUpdatedAt != null) row[colUpdatedAt] = now;

    newRows.push(row);
  });

  // Consecutivo
  if (colConsecutivo != null) {
    let nextConsec = 1;
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      const lastVal = last[colConsecutivo];
      if (lastVal !== "" && !isNaN(Number(lastVal))) {
        nextConsec = Number(lastVal) + 1;
      }
    }
    newRows.forEach((r, i) => {
      r[colConsecutivo] = nextConsec + i;
    });
  }

  if (newRows.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: PEDIDOS_SHEET_ID,
      range: `${SHEET_PEDIDOS}!A:AZ`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newRows },
    });
  }

  return { ok: true, driveFolderId: pedidoFolderId, pdfUrl: ocPdf.url };
}

// ===== WRAPPER PÚBLICO CON LOG DE ERRORES LINDO =====

export async function guardarPedido(payload: PedidoPayload) {
  try {
    return await guardarPedidoNode(payload);
  } catch (err: any) {
    console.error("Error guardando pedido (detalle):", {
      message: err?.message,
      code: err?.code,
      response: err?.response?.data,
    });

    // Este mensaje es el que ve el front
    throw new Error(
      err?.response?.data?.error?.message ||
        err?.message ||
        "Error guardando pedido"
    );
  }
}

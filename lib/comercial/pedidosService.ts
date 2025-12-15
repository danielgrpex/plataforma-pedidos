// lib/comercial/pedidosService.ts
// lib/comercial/pedidosService.ts
import { appendBasePrincipalRows } from "@/lib/google/googleSheets";
import { createFolder, uploadPdfToFolder } from "@/lib/google/googleDrive";
import { env } from "@/lib/config/env";

/* ============================
   TIPOS
============================ */

export type GuardarPedidoPayloadLegacy = {
  rows: string[][];
};

export type PedidoCabecera = {
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  asesor: string;
  obs?: string;
  fechaSolicitud?: string;
  created_by?: string;
};

export type PedidoItem = {
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  cantidad: string;
  acabados: string[];
  precioUnitario: string;
};

export type GuardarPedidoPayloadNuevo = {
  cabecera: PedidoCabecera;
  items: PedidoItem[];
  files?: {
    ocPdf?: {
      name: string;
      dataUrl: string;
    };
  };
};

export type GuardarPedidoPayload =
  | GuardarPedidoPayloadLegacy
  | GuardarPedidoPayloadNuevo;

export type GuardarPedidoResult = {
  success: boolean;
  message: string;
};

/* ============================
   HELPERS
============================ */

function isLegacy(payload: any): payload is GuardarPedidoPayloadLegacy {
  return payload && Array.isArray(payload.rows);
}

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function assertPositiveNumber(value: string, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} debe ser un número mayor a 0.`);
  }
  return n;
}

function assertPositiveInteger(value: string, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`${label} debe ser un número entero mayor a 0.`);
  }
  return n;
}

function formatNumber(n: number, decimals = 3) {
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

/* ============================
   CONSTRUCCIÓN DE FILAS
============================ */

function buildRowsFromNuevo(
  payload: GuardarPedidoPayloadNuevo,
  driveFolderLink: string
): string[][] {
  const cab = payload.cabecera;
  const items = payload.items;

  const fechaSolicitud = toStr(cab.fechaSolicitud || new Date().toISOString());
  const asesor = toStr(cab.asesor);
  const cliente = toStr(cab.cliente);
  const direccion = toStr(cab.direccion);
  const oc = toStr(cab.oc);
  const fechaRequerida = toStr(cab.fechaRequerida);
  const obs = toStr(cab.obs);
  const created_by = toStr(cab.created_by);

  return items.map((it, idx) => {
    const index = idx + 1;

    const referencia = toStr(it.referencia);
    const color = toStr(it.color);
    const ancho = toStr(it.ancho);
    const largoStr = toStr(it.largo);
    const cantidadStr = toStr(it.cantidad);
    const precioStr = toStr(it.precioUnitario);

    const acabadosArr = Array.isArray(it.acabados)
      ? it.acabados.map(toStr).filter(Boolean)
      : [];

    const largo = assertPositiveNumber(largoStr, `Largo (m) producto ${index}`);
    const cantidadUnd = assertPositiveInteger(
      cantidadStr,
      `Cantidad (und) producto ${index}`
    );
    assertPositiveNumber(precioStr, `Precio unitario producto ${index}`);

    const cantidadM = largo * cantidadUnd;

    const producto = [
      referencia,
      color,
      `${ancho} cm`,
      `${largoStr} m`,
      acabadosArr.length ? acabadosArr.join(", ") : "Sin acabados",
    ].join(" | ");

    const row: string[] = [
      "", // 1 Consecutivo
      fechaSolicitud, // 2 Fecha Solicitud
      asesor, // 3 Asesor
      cliente, // 4 Cliente
      direccion, // 5 Dirección
      oc, // 6 OC
      producto, // 7 Producto
      referencia, // 8 Referencia
      color, // 9 Color
      ancho, // 10 Ancho
      largoStr, // 11 Largo
      cantidadStr, // 12 Cantidad und
      formatNumber(cantidadM), // 13 Cantidad m
      acabadosArr.join(", "), // 14 Acabados
      precioStr, // 15 Precio unitario
      fechaRequerida, // 16 Fecha requerida
      obs, // 17 Observaciones comerciales
      "", // 18 Clasificación sugerida
      "", // 19 Clasificación planeación
      "", // 20 Observaciones planeación
      "", // 21 Revisado planeación
      "", // 22 Fecha revisión planeación
      "", // 23 Estado planeación
      "En verificación", // 24 Estado
      "", // 25 Fecha est. almacén
      "", // 26 Fecha real almacén
      "", // 27 Fecha est. despacho
      "", // 28 Fecha real despacho
      "", // 29 Transporte
      "", // 30 Fecha est. entrega cliente
      "", // 31 Guía
      "", // 32 Factura
      "", // 33 Remisión
      "", // 34 Fecha entrega real cliente
      "", // 35 Obs despacho
      driveFolderLink, // 36 Drive link
      created_by, // 37 Created by
    ];

    if (row.length !== 37) {
      throw new Error(
        `Error interno: la fila tiene ${row.length} columnas y deberían ser 37.`
      );
    }

    return row;
  });
}

/* ============================
   FUNCIÓN PRINCIPAL
============================ */

export async function guardarPedidoNode(
  data: GuardarPedidoPayload
): Promise<GuardarPedidoResult> {
  try {
    if (isLegacy(data)) {
      await appendBasePrincipalRows(data.rows);
      return { success: true, message: "Pedido guardado correctamente." };
    }

    const payload = data as GuardarPedidoPayloadNuevo;
    const { cabecera, files } = payload;

    const rootId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const pedidosFolder = await createFolder("PEDIDOS", rootId);
    const clienteFolder = await createFolder(cabecera.cliente, pedidosFolder.id);
    const ocFolder = await createFolder(cabecera.oc, clienteFolder.id);

    if (files?.ocPdf?.dataUrl) {
      const fileName = `${cabecera.cliente}_${cabecera.oc}.pdf`;
      await uploadPdfToFolder(ocFolder.id, fileName, files.ocPdf.dataUrl);
    }

    const rows = buildRowsFromNuevo(payload, ocFolder.webViewLink);
    await appendBasePrincipalRows(rows);

    return { success: true, message: "Pedido guardado correctamente." };
  } catch (error) {
    console.error("[guardarPedidoNode]", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error desconocido al guardar el pedido.",
    };
  }
}

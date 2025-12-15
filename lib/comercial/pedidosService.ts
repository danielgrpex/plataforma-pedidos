// lib/comercial/pedidosService.ts
import { appendBasePrincipalRows } from "@/lib/google/googleSheets";

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
  files?: any;
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

/**
 * Columnas (37):
 * 1  Consecutivo
 * 2  Fecha de Solicitud
 * 3  Asesor Comercial
 * 4  Cliente
 * 5  Dirección y ciudad de despacho
 * 6  Orden de Compra
 * 7  Producto
 * 8  Referencia
 * 9  Color
 * 10 Ancho
 * 11 Largo
 * 12 Cantidad (und)
 * 13 Cantidad (m)
 * 14 Acabados
 * 15 Precio Unitario
 * 16 Fecha Requerida Cliente
 * 17 Observaciones Comerciales
 * 18 Clasificación Sugerida
 * 19 Clasificación Planeación
 * 20 Observaciones Planeación
 * 21 Revisado Planeación
 * 22 Fecha Revisión Planeación
 * 23 Estado Planeación
 * 24 Estado
 * 25 Fecha Estimada Entrega Almacén
 * 26 Fecha Real Entrega Almacén
 * 27 Fecha Estimada Despacho
 * 28 Fecha Real Despacho
 * 29 Transporte
 * 30 Fecha Estimada Entrega Cliente
 * 31 Guia
 * 32 Factura
 * 33 Remision
 * 34 Fecha Entrega Real Cliente
 * 35 Observaciones de Despacho
 * 36 drive_folder_link
 * 37 created_by
 */

function buildRowsFromNuevo(payload: GuardarPedidoPayloadNuevo): string[][] {
  const cab = payload.cabecera ?? ({} as PedidoCabecera);
  const items = payload.items ?? [];

  const fechaSolicitud = toStr(cab.fechaSolicitud || new Date().toISOString());
  const asesor = toStr(cab.asesor);
  const cliente = toStr(cab.cliente);
  const direccion = toStr(cab.direccion);
  const oc = toStr(cab.oc);
  const fechaRequerida = toStr(cab.fechaRequerida);
  const obs = toStr(cab.obs);
  const created_by = toStr(cab.created_by);

  if (!cliente) throw new Error("Cliente es obligatorio.");
  if (!asesor) throw new Error("Asesor comercial es obligatorio.");
  if (!direccion) throw new Error("Dirección de despacho es obligatoria.");
  if (!oc) throw new Error("Orden de Compra es obligatoria.");
  if (!fechaRequerida)
    throw new Error("Fecha requerida del cliente es obligatoria.");

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Debes registrar al menos un producto.");
  }

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

    if (!referencia) throw new Error(`Referencia obligatoria (producto ${index})`);
    if (!color) throw new Error(`Color obligatorio (producto ${index})`);
    if (!ancho) throw new Error(`Ancho obligatorio (producto ${index})`);

    const largo = assertPositiveNumber(
      largoStr,
      `Largo (m) producto ${index}`
    );
    const cantidadUnd = assertPositiveInteger(
      cantidadStr,
      `Cantidad (und) producto ${index}`
    );
    assertPositiveNumber(
      precioStr,
      `Precio unitario producto ${index}`
    );

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
      fechaSolicitud, // 2 Fecha de Solicitud
      asesor, // 3 Asesor Comercial
      cliente, // 4 Cliente
      direccion, // 5 Dirección despacho
      oc, // 6 Orden de Compra
      producto, // 7 Producto
      referencia, // 8 Referencia
      color, // 9 Color
      ancho, // 10 Ancho
      largoStr, // 11 Largo
      cantidadStr, // 12 Cantidad (und)
      formatNumber(cantidadM), // 13 Cantidad (m)
      acabadosArr.join(", "), // 14 Acabados
      precioStr, // 15 Precio Unitario
      fechaRequerida, // 16 Fecha Requerida Cliente
      obs, // 17 Observaciones Comerciales
      "", // 18 Clasificación Sugerida
      "", // 19 Clasificación Planeación
      "", // 20 Observaciones Planeación
      "", // 21 Revisado Planeación
      "", // 22 Fecha Revisión Planeación
      "", // 23 Estado Planeación
      "En verificación", // 24 Estado
      "", // 25 Fecha Estimada Entrega Almacén
      "", // 26 Fecha Real Entrega Almacén
      "", // 27 Fecha Estimada Despacho
      "", // 28 Fecha Real Despacho
      "", // 29 Transporte
      "", // 30 Fecha Estimada Entrega Cliente
      "", // 31 Guia
      "", // 32 Factura
      "", // 33 Remision
      "", // 34 Fecha Entrega Real Cliente
      "", // 35 Observaciones de Despacho
      "", // 36 drive_folder_link
      created_by, // 37 created_by
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
    // Payload legacy
    if (isLegacy(data)) {
      if (!data.rows || data.rows.length === 0) {
        return {
          success: false,
          message: "No se recibieron filas para guardar.",
        };
      }

      await appendBasePrincipalRows(data.rows);

      return {
        success: true,
        message: "Pedido guardado correctamente.",
      };
    }

    // Payload nuevo
    const rows = buildRowsFromNuevo(data as GuardarPedidoPayloadNuevo);
    await appendBasePrincipalRows(rows);

    return {
      success: true,
      message: "Pedido guardado correctamente.",
    };
  } catch (error) {
    console.error("[guardarPedidoNode] Error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error desconocido al guardar el pedido.",
    };
  }
}

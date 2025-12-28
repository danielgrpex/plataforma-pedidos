// lib/comercial/pedidosService.ts
import { appendBasePrincipalRows } from "@/lib/google/googleSheets";

/* ============================
   TIPOS
============================ */

export type GuardarPedidoPayloadLegacy = {
  rows: any[][];
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
  ancho: string | number;        // ✅ ahora soporta number
  largo: string | number;        // ✅ ahora soporta number
  cantidad: string | number;     // ✅ ahora soporta number
  acabados: string[];
  precioUnitario: string | number; // ✅ ahora soporta number
};

export type GuardarPedidoPayloadNuevo = {
  cabecera: PedidoCabecera;
  items: PedidoItem[];

  /**
   * ✅ Path del PDF subido a Supabase Storage
   * Ej: "Cliente/OC/OC_2025-12-16T....pdf"
   */
  pdfPath?: string;
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

/**
 * ✅ Convierte "0,998" o "0.998" o "1.234,56" a number válido
 */
function parseDecimalAnyLocale(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;

  let s = String(v ?? "").trim();
  if (!s) return NaN;

  // quita espacios (incluyendo NBSP)
  s = s.replace(/\s|\u00A0/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  // Caso "1.234,56" => miles "." y decimal ","
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else if (hasComma) {
    // Caso "0,998" => decimal ","
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function assertPositiveNumber(value: unknown, label: string) {
  const n = parseDecimalAnyLocale(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} debe ser un número mayor a 0.`);
  }
  return n;
}

function assertPositiveInteger(value: unknown, label: string) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`${label} debe ser un número entero mayor a 0.`);
  }
  return n;
}

function formatNumberForDisplayComma(n: number, maxDecimals = 3) {
  // Ej: 0.998 => "0,998"
  const s = n.toFixed(maxDecimals).replace(/\.?0+$/, "");
  return s.replace(".", ",");
}

function formatNumber(n: number, decimals = 1) {
  // usado para cantidadM; lo dejamos “limpio”
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

/* ============================
   FILAS (37 COLS)
   Col 36 => pdfPath (Supabase Storage)
============================ */

function buildRowsFromNuevo(
  payload: GuardarPedidoPayloadNuevo,
  pdfPath: string
): any[][] {
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
  if (!fechaRequerida) throw new Error("Fecha requerida es obligatoria.");

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Debes registrar al menos un producto.");
  }

  const pdf = toStr(pdfPath);
  if (!pdf) throw new Error("Falta pdfPath (primero sube el PDF).");

  return items.map((it, idx) => {
    const n = idx + 1;

    const referencia = toStr(it.referencia);
    const color = toStr(it.color);

    const anchoNum = assertPositiveNumber(it.ancho, `Ancho (cm) producto ${n}`);
    const largoNum = assertPositiveNumber(it.largo, `Largo (m) producto ${n}`);
    const cantidadUnd = assertPositiveInteger(it.cantidad, `Cantidad (und) producto ${n}`);
    const precioNum = assertPositiveNumber(it.precioUnitario, `Precio unitario producto ${n}`);

    const acabadosArr = Array.isArray(it.acabados)
      ? it.acabados.map(toStr).filter(Boolean)
      : [];

    if (!referencia) throw new Error(`Referencia obligatoria (producto ${n}).`);
    if (!color) throw new Error(`Color obligatorio (producto ${n}).`);

    const cantidadM = largoNum * cantidadUnd;

    // Producto = Referencia + Color + Ancho + Largo + Acabados
    const producto = [
      referencia,
      color,
      `${formatNumberForDisplayComma(anchoNum, 3)} cm`,
      `${formatNumberForDisplayComma(largoNum, 3)} m`,
      acabadosArr.length ? acabadosArr.join(", ") : "Sin acabados",
    ].join(" | ");

    // ✅ IMPORTANTE:
    // Para que Sheets lo lea como NÚMERO independientemente de coma/punto,
    // enviamos numbers en columnas numéricas.
    const row: any[] = [
      "", // 1 Consecutivo
      fechaSolicitud, // 2 Fecha Solicitud
      asesor, // 3 Asesor
      cliente, // 4 Cliente
      direccion, // 5 Dirección
      oc, // 6 OC
      producto, // 7 Producto
      referencia, // 8 Referencia
      color, // 9 Color

      anchoNum, // 10 Ancho (NUM)
      largoNum, // 11 Largo (NUM)
      cantidadUnd, // 12 Cantidad und (NUM)
      Number(formatNumber(cantidadM, 1)), // 13 Cantidad m (NUM)
      acabadosArr.join(", "), // 14 Acabados
      precioNum, // 15 Precio unitario (NUM)

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
      pdf, // 36 ✅ PDF_PATH (Supabase)
      created_by, // 37 created_by
    ];

    if (row.length !== 37) {
      throw new Error(`Fila inválida: tiene ${row.length} columnas (deben ser 37).`);
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
    // ✅ Legacy (compat)
    if (isLegacy(data)) {
      if (!data.rows?.length) {
        return { success: false, message: "No se recibieron filas para guardar." };
      }
      await appendBasePrincipalRows(data.rows);
      return { success: true, message: "Pedido guardado correctamente." };
    }

    // ✅ Nuevo
    const payload = data as GuardarPedidoPayloadNuevo;

    const pdfPath = toStr(payload.pdfPath);
    const rows = buildRowsFromNuevo(payload, pdfPath);

    await appendBasePrincipalRows(rows);

    return { success: true, message: "Pedido guardado correctamente." };
  } catch (error) {
    console.error("[guardarPedidoNode]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

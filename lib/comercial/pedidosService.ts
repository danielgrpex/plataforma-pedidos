// lib/comercial/pedidosService.ts
import { appendBasePrincipalRows } from "@/lib/google/googleSheets";
import { uploadPedidoPdf } from "@/lib/supabase/storagePdf";

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
    ocPdf?: { name: string; dataUrl: string };
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
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} debe ser > 0.`);
  return n;
}

function assertPositiveInteger(value: string, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`${label} debe ser entero > 0.`);
  }
  return n;
}

function formatNumber(n: number, decimals = 3) {
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

/* ============================
   FILAS (37 COLS)
   Col 36 => PDF_PATH (Supabase)
============================ */

function buildRowsFromNuevo(
  payload: GuardarPedidoPayloadNuevo,
  pdfPath: string
): string[][] {
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

  return items.map((it, idx) => {
    const n = idx + 1;

    const referencia = toStr(it.referencia);
    const color = toStr(it.color);
    const ancho = toStr(it.ancho);
    const largoStr = toStr(it.largo);
    const cantidadStr = toStr(it.cantidad);
    const precioStr = toStr(it.precioUnitario);

    const acabadosArr = Array.isArray(it.acabados)
      ? it.acabados.map(toStr).filter(Boolean)
      : [];

    if (!referencia) throw new Error(`Referencia obligatoria (producto ${n}).`);
    if (!color) throw new Error(`Color obligatorio (producto ${n}).`);
    if (!ancho) throw new Error(`Ancho obligatorio (producto ${n}).`);

    const largo = assertPositiveNumber(largoStr, `Largo (m) producto ${n}`);
    const cantidadUnd = assertPositiveInteger(
      cantidadStr,
      `Cantidad (und) producto ${n}`
    );
    assertPositiveNumber(precioStr, `Precio unitario producto ${n}`);

    const cantidadM = largo * cantidadUnd;

    const producto = [
      referencia,
      color,
      `${ancho} cm`,
      `${largoStr} m`,
      acabadosArr.length ? acabadosArr.join(", ") : "Sin acabados",
    ].join(" | ");

    const row: string[] = [
      "", // 1
      fechaSolicitud, // 2
      asesor, // 3
      cliente, // 4
      direccion, // 5
      oc, // 6
      producto, // 7
      referencia, // 8
      color, // 9
      ancho, // 10
      largoStr, // 11
      cantidadStr, // 12
      formatNumber(cantidadM), // 13
      acabadosArr.join(", "), // 14
      precioStr, // 15
      fechaRequerida, // 16
      obs, // 17
      "", "", "", "", "", "", // 18-23
      "En verificación", // 24
      "", "", "", "", "", "", "", "", "", "", "", // 25-35
      pdfPath, // 36 ✅
      created_by, // 37
    ];

    if (row.length !== 37) {
      throw new Error(`Fila inválida: ${row.length} columnas (deben ser 37).`);
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
      if (!data.rows?.length) {
        return { success: false, message: "No se recibieron filas para guardar." };
      }
      await appendBasePrincipalRows(data.rows);
      return { success: true, message: "Pedido guardado correctamente." };
    }

    const payload = data as GuardarPedidoPayloadNuevo;
    const { cabecera, files } = payload;

    let pdfPath = "";
    if (files?.ocPdf?.dataUrl) {
      const up = await uploadPedidoPdf({
        cliente: cabecera.cliente,
        oc: cabecera.oc,
        dataUrl: files.ocPdf.dataUrl,
      });
      pdfPath = up.path;
    }

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

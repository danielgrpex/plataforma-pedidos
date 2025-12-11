// lib/comercial/pedidosService.ts
import { appendBasePrincipalRows } from "@/lib/google/googleSheets";

export type GuardarPedidoPayload = {
  /**
   * Filas ya listas para escribir en la hoja "Base Principal".
   * Cada sub–array es una fila y cada string es el valor de una celda.
   */
  rows: string[][];
};

export type GuardarPedidoResult = {
  success: boolean;
  message: string;
};

export async function guardarPedidoNode(
  data: GuardarPedidoPayload
): Promise<GuardarPedidoResult> {
  try {
    const rows = data?.rows;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return {
        success: false,
        message: "No se recibió ninguna fila para guardar (payload.rows está vacío).",
      };
    }

    await appendBasePrincipalRows(rows);

    return {
      success: true,
      message: "Pedido guardado correctamente en la hoja Base Principal.",
    };
  } catch (error) {
    console.error("[guardarPedidoNode] Error guardando pedido:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error desconocido al guardar el pedido.",
    };
  }
}


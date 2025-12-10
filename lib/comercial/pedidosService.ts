// lib/pedidosService.ts

export type GuardarPedidoPayload = any; // luego lo tipamos bien

export type GuardarPedidoResult = {
  success: boolean;
  message: string;
};

export async function guardarPedidoNode(
  _data: GuardarPedidoPayload
): Promise<GuardarPedidoResult> {
  // 👇 Por ahora es solo un stub para que compile en Vercel
  // Más adelante aquí implementamos:
  // - Crear carpeta en Drive
  // - Subir PDF
  // - Escribir en Base Principal
  return {
    success: false,
    message: "Función guardarPedidoNode aún no está implementada.",
  };
}

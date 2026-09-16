import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * =========================================================
 * ENDPOINT BLOQUEADO
 * =========================================================
 *
 * Antes este endpoint permitía cambiar manualmente:
 *
 * SolicitudesCorte.estadoitem
 * Generada → Empacado
 *
 * Esa operación ya NO está permitida.
 *
 * Desde la implementación de Control Producto en Proceso,
 * el estado Empacado solamente puede ser asignado
 * automáticamente por:
 *
 * /api/produccion/control-producto-proceso/transformacion
 *
 * cuando la cantidad pendiente del consecutivo llega a 0.
 *
 * Se conserva esta ruta temporalmente para bloquear
 * explícitamente cualquier interfaz, código antiguo o
 * llamada HTTP que todavía intente utilizarla.
 */

export async function POST() {
  return NextResponse.json(
    {
      ok: false,

      error:
        "El estado Empacado de una orden de corte ya no puede asignarse manualmente.",

      message:
        "Registra el consumo y la transformación desde Control Producto en Proceso. PEX marcará automáticamente el ítem como Empacado cuando la cantidad pendiente llegue a 0.",

      code:
        "CORTE_EMPACADO_MANUAL_BLOQUEADO",
    },
    {
      status: 403,

      headers: {
        "Cache-Control":
          "no-store, no-cache, max-age=0, must-revalidate",
      },
    }
  );
}
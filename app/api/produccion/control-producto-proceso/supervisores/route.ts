import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    const values = await getInfoSheetRange("Supervisores!A:A");

    /*
     * A1 = encabezado "Supervisores"
     * Desde A2 vienen los nombres.
     */
    const supervisores = values
      .slice(1)
      .map((row) => clean(row?.[0]))
      .filter(Boolean);

    /*
     * Quitamos duplicados por si accidentalmente
     * alguien repite un nombre en la hoja.
     */
    const unicos = Array.from(
      new Map(
        supervisores.map((nombre) => [
          nombre.toLowerCase(),
          nombre,
        ])
      ).values()
    );

    return NextResponse.json(
      {
        ok: true,
        total: unicos.length,
        supervisores: unicos,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, s-maxage=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET control producto proceso - supervisores]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible consultar los supervisores.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
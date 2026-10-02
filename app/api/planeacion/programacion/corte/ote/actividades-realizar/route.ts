import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
   ========================================================= */

function toStr(value: unknown) {
  return String(value ?? "").trim();
}

function normalizar(value: unknown) {
  return toStr(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  try {
    /*
     * Archivo Información
     * Hoja ActividadesRealizar
     *
     * A = Acabado
     * B = ActividadesRealizar
     */
    const values = await getInfoSheetRange(
      "ActividadesRealizar!A:B"
    );

    if (
      !Array.isArray(values) ||
      values.length <= 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La hoja ActividadesRealizar está vacía o no tiene datos.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const rows = values.slice(1);

    const items = rows
      .map((row, index) => {
        const acabado = toStr(row?.[0]);

        const actividadesRealizar = toStr(
          row?.[1]
        );

        if (!acabado) {
          return null;
        }

        return {
          sheetRow: index + 2,

          acabado,

          acabadoNormalizado:
            normalizar(acabado),

          actividadesRealizar,

          configurado:
            Boolean(
              actividadesRealizar
            ),
        };
      })
      .filter(Boolean);

    const configurados =
      items.filter(
        (item) =>
          item?.configurado
      ).length;

    const sinActividad =
      items.filter(
        (item) =>
          !item?.configurado
      ).length;

    return NextResponse.json(
      {
        success: true,

        resumen: {
          total: items.length,
          configurados,
          sinActividad,
        },

        items,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0, s-maxage=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[actividades-realizar]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error consultando ActividadesRealizar.",
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
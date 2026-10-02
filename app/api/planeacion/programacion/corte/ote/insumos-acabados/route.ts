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
     * Hoja InsumosAcabados
     *
     * A = Código Siigo
     * B = Insumo
     * C = Suma Sencillo cuando acabado es
     * D = Suma Doble cuando acabado es
     * E = Suma Triple cuando acabado es
     */

    const values = await getInfoSheetRange(
      "InsumosAcabados!A:E"
    );

    if (
      !Array.isArray(values) ||
      values.length <= 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La hoja InsumosAcabados está vacía o no tiene datos.",
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
        const codigoSiigo =
          toStr(row?.[0]);

        const insumo =
          toStr(row?.[1]);

        const acabadoSencillo =
          toStr(row?.[2]);

        const acabadoDoble =
          toStr(row?.[3]);

        const acabadoTriple =
          toStr(row?.[4]);

        if (
          !codigoSiigo &&
          !insumo
        ) {
          return null;
        }

        return {
          sheetRow: index + 2,

          codigoSiigo,

          insumo,

          acabadoSencillo,

          acabadoSencilloNormalizado:
            normalizar(
              acabadoSencillo
            ),

          acabadoDoble,

          acabadoDobleNormalizado:
            normalizar(
              acabadoDoble
            ),

          acabadoTriple,

          acabadoTripleNormalizado:
            normalizar(
              acabadoTriple
            ),

          configurado:
            Boolean(
              codigoSiigo &&
              insumo &&
              (
                acabadoSencillo ||
                acabadoDoble ||
                acabadoTriple
              )
            ),
        };
      })
      .filter(Boolean);

    const configurados =
      items.filter(
        (item) =>
          item?.configurado
      ).length;

    const sinConfigurar =
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
          sinConfigurar,
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
      "[insumos-acabados]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error consultando InsumosAcabados.",
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
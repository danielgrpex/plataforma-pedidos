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
    .trim();
}

function referenciaBase(producto: unknown) {
  const texto = toStr(producto);

  if (!texto) {
    return "";
  }

  /*
   * Ejemplo:
   *
   * Perfil C/Regleta Deslizante | Gris | 4 cm | 2,4 m | Sin acabados
   *
   * =>
   *
   * Perfil C/Regleta Deslizante
   */
  return texto
    .split("|")[0]
    ?.trim() || "";
}

function toFactor(value: unknown) {
  const numero = Number(
    String(value ?? "")
      .trim()
      .replace(",", ".")
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const productoFinalConsultado =
      toStr(
        searchParams.get(
          "productoFinal"
        )
      );

    const productoFinalBase =
      referenciaBase(
        productoFinalConsultado
      );

    /*
     * Información
     * Hoja: ComposicionEmpaque
     *
     * A = ProductoFinal
     * B = Componente
     * C = FactorPorUnidad
     */
    const values =
      await getInfoSheetRange(
        "ComposicionEmpaque!A:C"
      );

    if (
      !Array.isArray(values) ||
      values.length <= 1
    ) {
      return NextResponse.json(
        {
          ok: true,

          productoFinalConsultado,

          productoFinalBase,

          tieneComposicion:
            false,

          componentes: [],

          totalComponentes: 0,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const rows =
      values.slice(1);

    const maestro =
      rows
        .map(
          (
            row,
            index
          ) => {
            const productoFinal =
              toStr(row?.[0]);

            const componente =
              toStr(row?.[1]);

            const factorPorUnidad =
              toFactor(row?.[2]);

            if (
              !productoFinal ||
              !componente ||
              factorPorUnidad <= 0
            ) {
              return null;
            }

            return {
              sheetRow:
                index + 2,

              productoFinal,

              productoFinalNormalizado:
                normalizar(
                  productoFinal
                ),

              componente,

              componenteNormalizado:
                normalizar(
                  componente
                ),

              factorPorUnidad,
            };
          }
        )
        .filter(Boolean);

    /*
     * Si no mandamos productoFinal,
     * devolvemos todo el maestro.
     *
     * Esto sirve para revisar rápidamente
     * que PEX esté leyendo bien la hoja.
     */
    if (
      !productoFinalConsultado
    ) {
      return NextResponse.json(
        {
          ok: true,

          total:
            maestro.length,

          items:
            maestro,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const keyObjetivo =
      normalizar(
        productoFinalBase
      );

    const componentes =
      maestro.filter(
        (item) =>
          item?.productoFinalNormalizado ===
          keyObjetivo
      );

    return NextResponse.json(
      {
        ok: true,

        productoFinalConsultado,

        productoFinalBase,

        tieneComposicion:
          componentes.length >
          0,

        totalComponentes:
          componentes.length,

        componentes:
          componentes.map(
            (item) => ({
              sheetRow:
                item!.sheetRow,

              productoFinal:
                item!.productoFinal,

              componente:
                item!.componente,

              factorPorUnidad:
                item!.factorPorUnidad,
            })
          ),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0, s-maxage=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[composicion-empaque]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar ComposicionEmpaque.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
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

function normalizarProducto(value: unknown) {
  return toStr(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*\|\s*/g, "|")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCantidadPaquete(value: unknown) {
  if (typeof value === "number") {
    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      return Math.floor(value);
    }

    return null;
  }

  const text = toStr(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(normalized);

  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return null;
  }

  return Math.floor(n);
}

function detectarTipo(
  valorOriginal: unknown
) {
  const value = toStr(
    valorOriginal
  )
    .toUpperCase()
    .trim();

  if (!value) {
    return {
      tipo: "SIN_CONFIGURAR",
      requiereValidacion: true,
      motivo:
        "No tiene cantidad configurada.",
    };
  }

  if (
    value.includes(
      "DEPENDE LARGO"
    )
  ) {
    return {
      tipo: "DEPENDE_LARGO",
      requiereValidacion: true,
      motivo:
        "La cantidad por paquete depende del largo.",
    };
  }

  if (
    value.includes(
      "DEPENDE ACABADO"
    )
  ) {
    return {
      tipo: "DEPENDE_ACABADOS",
      requiereValidacion: true,
      motivo:
        "La cantidad por paquete depende de los acabados.",
    };
  }

  const cantidad =
    parseCantidadPaquete(
      valorOriginal
    );

  if (cantidad) {
    return {
      tipo: "FIJO",
      requiereValidacion: false,
      motivo: "",
    };
  }

  return {
    tipo: "REVISAR",
    requiereValidacion: true,
    motivo:
      "El valor configurado no es una cantidad numérica reconocida.",
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  try {
    /*
     * Archivo Información
     * Hoja UnidadEmpaqueTrazas
     *
     * A = ProductoInicial
     * B = CantidadPorPaquete
     */
    const values =
      await getInfoSheetRange(
        "UnidadEmpaqueTrazas!A:B"
      );

    if (
      !Array.isArray(values) ||
      values.length <= 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La hoja UnidadEmpaqueTrazas está vacía o no tiene datos.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const rows =
      values.slice(1);

    const items = rows
      .map((row, index) => {
        const productoInicial =
          toStr(row?.[0]);

        const valorOriginal =
          toStr(row?.[1]);

        if (!productoInicial) {
          return null;
        }

        const cantidadPorPaquete =
          parseCantidadPaquete(
            row?.[1]
          );

        const clasificacion =
          detectarTipo(
            row?.[1]
          );

        return {
          sheetRow:
            index + 2,

          productoInicial,

          productoNormalizado:
            normalizarProducto(
              productoInicial
            ),

          valorOriginal,

          cantidadPorPaquete,

          tipo:
            clasificacion.tipo,

          requiereValidacion:
            clasificacion.requiereValidacion,

          motivo:
            clasificacion.motivo,
        };
      })
      .filter(Boolean);

    /* =====================================================
       RESUMEN
       ===================================================== */

    const fijos =
      items.filter(
        (item) =>
          item?.tipo ===
          "FIJO"
      ).length;

    const dependeLargo =
      items.filter(
        (item) =>
          item?.tipo ===
          "DEPENDE_LARGO"
      ).length;

    const dependeAcabados =
      items.filter(
        (item) =>
          item?.tipo ===
          "DEPENDE_ACABADOS"
      ).length;

    const revisar =
      items.filter(
        (item) =>
          item?.requiereValidacion &&
          item?.tipo !==
            "DEPENDE_LARGO" &&
          item?.tipo !==
            "DEPENDE_ACABADOS"
      ).length;

    return NextResponse.json(
      {
        success: true,

        resumen: {
          total:
            items.length,

          fijos,

          dependeLargo,

          dependeAcabados,

          revisar,
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
      "[unidad-empaque-trazas]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error consultando UnidadEmpaqueTrazas.",
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
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStr(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = toStr(value);

  if (!text) return 0;

  if (text.includes(",") && text.includes(".")) {
    const n = Number(
      text.replace(/\./g, "").replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  if (text.includes(",")) {
    const n = Number(
      text.replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(text);

  return Number.isFinite(n) ? n : 0;
}

function rowsWithIndex(values: any[][]) {
  if (!values?.length) {
    return {
      headers: [],
      rows: [] as Record<string, any>[],
    };
  }

  const headers = (values[0] ?? []).map((h) =>
    toStr(h)
  );

  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = {
      sheetRow: i + 2,
    };

    headers.forEach((header, index) => {
      const value = row?.[index] ?? "";

      obj[header] = value;
      obj[header.toLowerCase()] = value;
    });

    return obj;
  });

  return {
    headers,
    rows,
  };
}

export async function GET() {
  try {
    const values = await getBasePrincipalRange(
      "InventarioProceso!A:K"
    );

    const { rows } = rowsWithIndex(values);

    const inventario = rows
      .map((row) => {
        const cantidadDisponible = toNumber(
          row.cantidadDisponible ??
            row.cantidaddisponible
        );

        const medidaMm = toNumber(
          row.medida_mm ??
            row.medidamm
        );

        return {
          sheetRow: row.sheetRow,

          inventarioKey: toStr(
            row.inventarioKey ??
              row.inventariokey
          ),

          OPE: toStr(
            row.OPE ??
              row.ope
          ),

          producto: toStr(
            row.producto
          ),

          referencia: toStr(
            row.referencia
          ),

          color: toStr(
            row.color
          ),

          ancho: toStr(
            row.ancho
          ),

          acabado: toStr(
            row.acabado
          ),

          medida_mm: medidaMm,

          cantidadDisponible,

          fechaUltimoMovimiento: toStr(
            row.fechaUltimoMovimiento ??
              row.fechaultimomovimiento
          ),

          estado: toStr(
            row.estado
          ),
        };
      })
      /*
       * Inventario actual = solo lo que físicamente
       * tiene saldo disponible.
       */
      .filter(
        (item) =>
          item.inventarioKey &&
          item.cantidadDisponible > 0
      )
      .sort((a, b) => {
        const opeCompare = b.OPE.localeCompare(
          a.OPE,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );

        if (opeCompare !== 0) {
          return opeCompare;
        }

        return b.medida_mm - a.medida_mm;
      });

    const totalUnidades = inventario.reduce(
      (total, item) =>
        total + item.cantidadDisponible,
      0
    );

    const lotes = new Set(
      inventario.map((item) => item.OPE)
    );

    return NextResponse.json(
      {
        ok: true,

        totalRegistros: inventario.length,

        totalLotes: lotes.size,

        totalUnidades,

        inventario,
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
      "[GET control producto proceso - inventario]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible consultar el inventario de producto en proceso.",
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
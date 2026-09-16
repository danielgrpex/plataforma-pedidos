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
    const n = Number(text.replace(",", "."));

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
      "MovimientosProceso!A:U"
    );

    const { rows } = rowsWithIndex(values);

    const movimientos = rows
      .map((row) => {
        return {
          sheetRow: row.sheetRow,

          movimientoKey: toStr(
            row.movimientoKey ??
              row.movimientokey
          ),

          timestamp: toStr(
            row.timestamp
          ),

          tipoMovimiento: toStr(
            row.tipoMovimiento ??
              row.tipomovimiento
          ),

          OPE: toStr(
            row.OPE ??
              row.ope
          ),

          OTE: toStr(
            row.OTE ??
              row.ote
          ),

          consecutivoCorte: toStr(
            row.consecutivoCorte ??
              row.consecutivocorte
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

          medida_mm: toNumber(
            row.medida_mm ??
              row.medidamm
          ),

          cantidadMovimiento: toNumber(
            row.cantidadMovimiento ??
              row.cantidadmovimiento
          ),

          inventarioKey: toStr(
            row.inventarioKey ??
              row.inventariokey
          ),

          transformacionKey: toStr(
            row.transformacionKey ??
              row.transformacionkey
          ),

          usuario: toStr(
            row.usuario
          ),

          turno: toStr(
            row.turno
          ),

          observacion: toStr(
            row.observacion
          ),

          movimientoRelacionado: toStr(
            row.movimientoRelacionado ??
              row.movimientorelacionado
          ),

          estado: toStr(
            row.estado
          ),

          supervisor: toStr(
            row.supervisor
          ),
        };
      })
      .filter((item) => item.movimientoKey)
      .sort((a, b) => {
        const fechaA = new Date(
          a.timestamp
        ).getTime();

        const fechaB = new Date(
          b.timestamp
        ).getTime();

        if (
          Number.isFinite(fechaA) &&
          Number.isFinite(fechaB)
        ) {
          return fechaB - fechaA;
        }

        return b.sheetRow - a.sheetRow;
      });

    const activos = movimientos.filter(
      (item) =>
        item.estado
          .trim()
          .toLowerCase() !== "anulado"
    );

    const entradas = activos
      .filter(
        (item) =>
          item.cantidadMovimiento > 0
      )
      .reduce(
        (total, item) =>
          total +
          item.cantidadMovimiento,
        0
      );

    const salidas = activos
      .filter(
        (item) =>
          item.cantidadMovimiento < 0
      )
      .reduce(
        (total, item) =>
          total +
          Math.abs(
            item.cantidadMovimiento
          ),
        0
      );

    return NextResponse.json(
      {
        ok: true,

        totalMovimientos:
          movimientos.length,

        movimientosActivos:
          activos.length,

        totalEntradasUnd:
          entradas,

        totalSalidasUnd:
          salidas,

        movimientos,
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
      "[GET control producto proceso - historial]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "No fue posible consultar el historial de producto en proceso.",
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
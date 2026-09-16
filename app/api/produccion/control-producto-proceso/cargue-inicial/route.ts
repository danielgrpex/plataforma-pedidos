import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
   ========================================================= */

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

function norm(value: unknown) {
  return toStr(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(value: unknown) {
  return norm(value).replace(/\s+/g, "");
}

function rowsWithIndex(values: any[][]) {
  if (!values?.length) {
    return {
      headers: [] as string[],
      rows: [] as Record<string, any>[],
    };
  }

  const headers = (values[0] ?? []).map((h) =>
    toStr(h)
  );

  const rows = values.slice(1).map((row, index) => {
    const obj: Record<string, any> = {
      sheetRow: index + 2,
    };

    headers.forEach((header, columnIndex) => {
      const value = row?.[columnIndex] ?? "";

      obj[header] = value;
      obj[header.toLowerCase()] = value;
      obj[normKey(header)] = value;
    });

    return obj;
  });

  return {
    headers,
    rows,
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  try {
    const values = await getBasePrincipalRange(
      "CargueInicialProceso!A:N"
    );

    const { headers, rows } =
      rowsWithIndex(values);

    /* =======================================================
       VALIDAR ESTRUCTURA DE LA HOJA
       ======================================================= */

    const requeridos = [
      "cargueKey",
      "OPE",
      "producto",
      "referencia",
      "color",
      "ancho",
      "acabado",
      "medida_mm",
      "cantidadFisica",
      "responsableConteo",
      "fechaConteo",
      "observacion",
      "procesado",
      "fechaProcesado",
    ];

    const headersNormalizados = new Set(
      headers.map((header) => normKey(header))
    );

    const faltantes = requeridos.filter(
      (header) =>
        !headersNormalizados.has(normKey(header))
    );

    if (faltantes.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan columnas requeridas en CargueInicialProceso.",
          faltantes,
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    /* =======================================================
       NORMALIZAR REGISTROS
       ======================================================= */

    const registros = rows
      .map((row) => {
        const cargueKey = toStr(
          row.cargueKey ?? row.carguekey
        );

        const OPE = toStr(
          row.OPE ?? row.ope
        );

        const producto = toStr(
          row.producto
        );

        const referencia = toStr(
          row.referencia
        );

        const color = toStr(
          row.color
        );

        const ancho = toStr(
          row.ancho
        );

        const acabado = toStr(
          row.acabado
        );

        const medida_mm = toNumber(
          row.medida_mm ?? row.medidamm
        );

        const cantidadFisica = toNumber(
          row.cantidadFisica ??
            row.cantidadfisica
        );

        const responsableConteo = toStr(
          row.responsableConteo ??
            row.responsableconteo
        );

        const fechaConteo = toStr(
          row.fechaConteo ??
            row.fechaconteo
        );

        const observacion = toStr(
          row.observacion
        );

        const procesado = toStr(
          row.procesado
        );

        const fechaProcesado = toStr(
          row.fechaProcesado ??
            row.fechaprocesado
        );

        const procesadoNorm =
          norm(procesado);

        const yaProcesado =
          procesadoNorm === "si" ||
          procesadoNorm === "sí" ||
          procesadoNorm === "procesado";

        const errores: string[] = [];

        if (!OPE) {
          errores.push("Falta OPE.");
        }

        if (!producto) {
          errores.push("Falta producto.");
        }

        if (medida_mm <= 0) {
          errores.push(
            "La medida_mm debe ser mayor a 0."
          );
        }

        if (cantidadFisica <= 0) {
          errores.push(
            "La cantidadFisica debe ser mayor a 0."
          );
        }

        if (!responsableConteo) {
          errores.push(
            "Falta responsableConteo."
          );
        }

        if (!fechaConteo) {
          errores.push(
            "Falta fechaConteo."
          );
        }

        return {
          sheetRow: row.sheetRow,

          cargueKey,

          OPE,

          producto,

          referencia,

          color,

          ancho,

          acabado,

          medida_mm,

          cantidadFisica,

          responsableConteo,

          fechaConteo,

          observacion,

          procesado,

          fechaProcesado,

          yaProcesado,

          valido:
            errores.length === 0,

          errores,
        };
      })
      /*
       * Ignoramos filas completamente vacías.
       */
      .filter((row) => {
        return (
          row.OPE ||
          row.producto ||
          row.cantidadFisica ||
          row.medida_mm
        );
      });

    /* =======================================================
       CLASIFICAR
       ======================================================= */

    const pendientes = registros.filter(
      (row) => !row.yaProcesado
    );

    const procesados = registros.filter(
      (row) => row.yaProcesado
    );

    const pendientesValidos = pendientes.filter(
      (row) => row.valido
    );

    const pendientesConError = pendientes.filter(
      (row) => !row.valido
    );

    /* =======================================================
       TOTALES
       ======================================================= */

    const totalUnidadesPendientes =
      pendientesValidos.reduce(
        (total, row) =>
          total + row.cantidadFisica,
        0
      );

    const totalUnidadesProcesadas =
      procesados.reduce(
        (total, row) =>
          total + row.cantidadFisica,
        0
      );

    return NextResponse.json(
      {
        ok: true,

        totalRegistros:
          registros.length,

        totalPendientes:
          pendientes.length,

        totalPendientesValidos:
          pendientesValidos.length,

        totalPendientesConError:
          pendientesConError.length,

        totalProcesados:
          procesados.length,

        totalUnidadesPendientes,

        totalUnidadesProcesadas,

        pendientes,

        procesados,
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
      "[GET control producto proceso - cargue inicial]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible consultar el cargue inicial de producto en proceso.",
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
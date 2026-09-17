//app/api/produccion/entregas-almacen/produccion/actualizar-estado/route.ts
import { NextResponse } from "next/server";
import {
  getSheetsClient,
  getBasePrincipalRange,
} from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
   ========================================================= */

function getHeaders(values: any[][]) {
  return (values?.[0] ?? []).map((h) =>
    String(h ?? "").trim()
  );
}

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// 0 -> A, 25 -> Z, 26 -> AA ...
function columnToLetter(colIndex0: number) {
  let n = colIndex0;
  let s = "";

  while (n >= 0) {
    s =
      String.fromCharCode((n % 26) + 65) +
      s;

    n = Math.floor(n / 26) - 1;
  }

  return s;
}

/* =========================================================
   POST

   ÚNICA TRANSICIÓN PERMITIDA DESDE MÁQUINAS:

   Generada -> Producido

   Empacado NO puede asignarse desde este endpoint.
   ========================================================= */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rowIndex = Number(
      body.rowIndex
    );

    if (
      !Number.isInteger(rowIndex) ||
      rowIndex < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Falta o es inválido el rowIndex.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =====================================================
       1. LEER ENCABEZADOS
       ===================================================== */

    const headerValues =
      await getBasePrincipalRange(
        "SolicitudesProduccion!1:1"
      );

    const headers =
      getHeaders(headerValues);

    const headersLower =
      headers.map((h) =>
        h.toLowerCase()
      );

    const idxEstado =
      headersLower.indexOf(
        "estado"
      );

    if (idxEstado < 0) {
      return NextResponse.json(
        {
          error:
            "No existe la columna 'estado' en SolicitudesProduccion.",
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

    /* =====================================================
       2. RELEER FILA ACTUAL

       No confiamos solamente en lo mostrado en pantalla.
       ===================================================== */

    const rowValues =
      await getBasePrincipalRange(
        `SolicitudesProduccion!${rowIndex}:${rowIndex}`
      );

    const row =
      rowValues?.[0] ?? [];

    if (!row.length) {
      return NextResponse.json(
        {
          error:
            "No se encontró el ítem de producción.",
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

    const estadoActual =
      String(
        row[idxEstado] ?? ""
      ).trim();

    /* =====================================================
       3. SOLO GENERADA PUEDE PASAR A PRODUCIDO
       ===================================================== */

    if (
      norm(estadoActual) !==
      "generada"
    ) {
      return NextResponse.json(
        {
          error:
            `El ítem ya no está en estado Generada. Estado actual: ${
              estadoActual || "Sin estado"
            }.`,
          estadoActual,
        },
        {
          status: 409,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =====================================================
       4. NUEVO ESTADO FIJO

       Desde máquinas NO existe opción Empacado.
       ===================================================== */

    const nuevoEstado =
      "Producido";

    const colLetter =
      columnToLetter(
        idxEstado
      );

    const sheets =
      await getSheetsClient();

    await sheets.spreadsheets.values.update(
      {
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          `SolicitudesProduccion!${colLetter}${rowIndex}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {
          values: [
            [
              nuevoEstado,
            ],
          ],
        },
      }
    );

    /* =====================================================
       RESPUESTA
       ===================================================== */

    return NextResponse.json(
      {
        ok: true,

        rowIndex,

        estadoAnterior:
          estadoActual,

        nuevoEstado:
          "Producido",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    console.error(
      "[POST prod actualizar estado]",
      e
    );

    return NextResponse.json(
      {
        error:
          "Error interno actualizando el estado de producción.",
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
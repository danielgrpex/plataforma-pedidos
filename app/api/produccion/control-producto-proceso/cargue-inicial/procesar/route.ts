import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
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
    const n = Number(
      text.replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(text);

  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown) {
  const n = Math.floor(
    toNumber(value)
  );

  return Number.isFinite(n)
    ? Math.max(0, n)
    : 0;
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

function makeId(prefix: string) {
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase();

  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `${prefix}_${timestamp}_${random}`;
}

function buildHeaderIndex(header: any[]) {
  const index = new Map<string, number>();

  header.forEach((value, i) => {
    const key = normKey(value);

    if (key) {
      index.set(key, i);
    }
  });

  return index;
}

function pickCell(
  row: any[],
  index: Map<string, number>,
  ...keys: string[]
) {
  for (const key of keys) {
    const position =
      index.get(normKey(key));

    if (position !== undefined) {
      return row[position];
    }
  }

  return "";
}

function toColLetter(index0: number) {
  let number = index0 + 1;
  let result = "";

  while (number > 0) {
    const remainder =
      (number - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder
      ) + result;

    number = Math.floor(
      (number - 1) / 26
    );
  }

  return result;
}

/* =========================================================
   INVENTARIO KEY

   Misma lógica utilizada por el Control Producto en Proceso.
   ========================================================= */

function makeInventarioKey(
  OPE: string,
  producto: string,
  medidaMm: number
) {
  const base =
    `${norm(OPE)}|${norm(producto)}|${medidaMm}`;

  const hash = createHash("sha1")
    .update(base)
    .digest("hex")
    .slice(0, 14)
    .toUpperCase();

  return `IPP_${hash}`;
}

/* =========================================================
   BODY
   ========================================================= */

type Body = {
  sheetRow?: number;
  usuario?: string;
};

/* =========================================================
   POST
   ========================================================= */

export async function POST(req: Request) {
  try {
    const body =
      (await req.json()) as Body;

    const sheetRow =
      toInt(body.sheetRow);

    const usuario =
      toStr(body.usuario) ||
      "cargue-inicial";

    if (sheetRow < 2) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La fila del cargue inicial no es válida.",
        },
        { status: 400 }
      );
    }

    const sheets =
      await getSheetsClient();

    const spreadsheetId =
      env.SHEET_BASE_PRINCIPAL_ID;

    const timestamp =
      new Date().toISOString();

    /* =======================================================
       1. LEER CARGUE INICIAL
       ======================================================= */

    const cargueResp =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          "CargueInicialProceso!A:N",
        valueRenderOption:
          "UNFORMATTED_VALUE",
      });

    const cargueValues =
      (cargueResp.data.values ||
        []) as any[][];

    if (!cargueValues.length) {
      throw new Error(
        "No existe información en CargueInicialProceso."
      );
    }

    const cargueHeader =
      cargueValues[0] || [];

    const cargueIdx =
      buildHeaderIndex(
        cargueHeader
      );

    const row =
      cargueValues[
        sheetRow - 1
      ];

    if (!row) {
      return NextResponse.json(
        {
          success: false,
          message:
            `No existe la fila ${sheetRow} en CargueInicialProceso.`,
        },
        { status: 404 }
      );
    }

    /* =======================================================
       2. EXTRAER DATOS
       ======================================================= */

    let cargueKey =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "cargueKey"
        )
      );

    const OPE =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "OPE"
        )
      );

    const producto =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "producto"
        )
      );

    const referencia =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "referencia"
        )
      );

    const color =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "color"
        )
      );

    const ancho =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "ancho"
        )
      );

    const acabado =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "acabado"
        )
      );

    const medidaMm =
      toInt(
        pickCell(
          row,
          cargueIdx,
          "medida_mm"
        )
      );

    const cantidadFisica =
      toInt(
        pickCell(
          row,
          cargueIdx,
          "cantidadFisica"
        )
      );

    const responsableConteo =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "responsableConteo"
        )
      );

    const fechaConteo =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "fechaConteo"
        )
      );

    const observacion =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "observacion"
        )
      );

    const procesado =
      toStr(
        pickCell(
          row,
          cargueIdx,
          "procesado"
        )
      );

    /* =======================================================
       3. VALIDACIONES
       ======================================================= */

    const procesadoNorm =
      norm(procesado);

    if (
      procesadoNorm === "si" ||
      procesadoNorm === "sí" ||
      procesadoNorm === "procesado"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Esta fila ya fue procesada anteriormente.",
        },
        { status: 409 }
      );
    }

    if (!OPE) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La fila no tiene OPE.",
        },
        { status: 400 }
      );
    }

    if (!producto) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La fila no tiene producto.",
        },
        { status: 400 }
      );
    }

    if (medidaMm <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La medida_mm debe ser mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (cantidadFisica <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La cantidad física debe ser mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (!responsableConteo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La fila no tiene responsable del conteo.",
        },
        { status: 400 }
      );
    }

    if (!fechaConteo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La fila no tiene fecha de conteo.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       4. CREAR cargueKey SI ESTÁ VACÍO

       Esto ocurre ANTES de crear el movimiento.

       Así, si hubiera un corte de conexión, el reintento
       sigue utilizando la misma llave.
       ======================================================= */

    if (!cargueKey) {
      cargueKey =
        makeId("CIPP");

      const colCargueKey =
        cargueIdx.get(
          normKey("cargueKey")
        );

      if (
        colCargueKey === undefined
      ) {
        throw new Error(
          "No existe la columna cargueKey."
        );
      }

      const colLetter =
        toColLetter(
          colCargueKey
        );

      await sheets.spreadsheets.values.update({
        spreadsheetId,

        range:
          `CargueInicialProceso!${colLetter}${sheetRow}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {
          values: [
            [cargueKey],
          ],
        },
      });
    }

    /* =======================================================
       5. INVENTARIO KEY
       ======================================================= */

    const inventarioKey =
      makeInventarioKey(
        OPE,
        producto,
        medidaMm
      );

    const movimientoRelacionado =
      `CARGUE_INICIAL|${cargueKey}`;

    /* =======================================================
       6. LEER MOVIMIENTOS E INVENTARIO ACTUAL
       ======================================================= */

    const [
      movimientosResp,
      inventarioResp,
    ] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          "MovimientosProceso!A:U",
        valueRenderOption:
          "UNFORMATTED_VALUE",
      }),

      sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          "InventarioProceso!A:K",
        valueRenderOption:
          "UNFORMATTED_VALUE",
      }),
    ]);

    const movimientosValues =
      (movimientosResp.data.values ||
        []) as any[][];

    const inventarioValues =
      (inventarioResp.data.values ||
        []) as any[][];

    const movimientosHeader =
      movimientosValues[0] || [];

    const movimientosRows =
      movimientosValues.length > 1
        ? movimientosValues.slice(1)
        : [];

    const movimientosIdx =
      buildHeaderIndex(
        movimientosHeader
      );

    const inventarioHeader =
      inventarioValues[0] || [];

    const inventarioRows =
      inventarioValues.length > 1
        ? inventarioValues.slice(1)
        : [];

    const inventarioIdx =
      buildHeaderIndex(
        inventarioHeader
      );

    /* =======================================================
       7. IDEMPOTENCIA

       Si el movimiento ya existe, NO lo creamos otra vez.
       ======================================================= */

    const movimientoYaExiste =
      movimientosRows.some(
        (mov) =>
          toStr(
            pickCell(
              mov,
              movimientosIdx,
              "movimientoRelacionado"
            )
          ) ===
          movimientoRelacionado
      );

    let movimientoCreado =
      false;

    if (!movimientoYaExiste) {
      const observacionMovimiento =
        [
          "Cargue inicial de producto en proceso",

          `Conteo: ${fechaConteo}`,

          `Responsable: ${responsableConteo}`,

          observacion,
        ]
          .filter(Boolean)
          .join(" · ");

      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range:
          "MovimientosProceso!A:U",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            [
              makeId("MOVPP"), // A movimientoKey
              timestamp, // B timestamp
              "CARGUE_INICIAL", // C tipoMovimiento
              OPE, // D OPE
              "", // E OTE
              "", // F consecutivoCorte
              producto, // G producto
              referencia, // H referencia
              color, // I color
              ancho, // J ancho
              acabado, // K acabado
              medidaMm, // L medida_mm
              cantidadFisica, // M cantidadMovimiento
              inventarioKey, // N inventarioKey
              "", // O transformacionKey
              usuario, // P usuario
              "", // Q turno
              observacionMovimiento, // R observacion
              movimientoRelacionado, // S movimientoRelacionado
              "ACTIVO", // T estado
              responsableConteo, // U supervisor/responsable
            ],
          ],
        },
      });

      movimientoCreado =
        true;
    }

    /* =======================================================
       8. VOLVER A LEER MOVIMIENTOS

       Así obtenemos el saldo verdadero del kardex
       incluyendo el CARGUE_INICIAL recién creado.
       ======================================================= */

    const movimientosActualizadosResp =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          "MovimientosProceso!A:U",
        valueRenderOption:
          "UNFORMATTED_VALUE",
      });

    const movimientosActualizadosValues =
      (movimientosActualizadosResp.data.values ||
        []) as any[][];

    const movimientosActualizadosHeader =
      movimientosActualizadosValues[0] ||
      [];

    const movimientosActualizadosRows =
      movimientosActualizadosValues.length > 1
        ? movimientosActualizadosValues.slice(1)
        : [];

    const movimientosActualizadosIdx =
      buildHeaderIndex(
        movimientosActualizadosHeader
      );

    let saldoFinal = 0;

    for (
      const mov of
        movimientosActualizadosRows
    ) {
      const estado =
        norm(
          pickCell(
            mov,
            movimientosActualizadosIdx,
            "estado"
          )
        );

      if (
        estado === "anulado"
      ) {
        continue;
      }

      const key =
        toStr(
          pickCell(
            mov,
            movimientosActualizadosIdx,
            "inventarioKey"
          )
        );

      if (
        key !== inventarioKey
      ) {
        continue;
      }

      saldoFinal +=
        toNumber(
          pickCell(
            mov,
            movimientosActualizadosIdx,
            "cantidadMovimiento"
          )
        );
    }

    /* =======================================================
       9. ACTUALIZAR / CREAR INVENTARIO
       ======================================================= */

    const inventarioIndex =
      inventarioRows.findIndex(
        (inv) =>
          toStr(
            pickCell(
              inv,
              inventarioIdx,
              "inventarioKey"
            )
          ) ===
          inventarioKey
      );

    const estadoInventario =
      saldoFinal > 0
        ? "Disponible"
        : saldoFinal === 0
          ? "Agotado"
          : "REVISAR";

    if (
      inventarioIndex >= 0
    ) {
      const sheetRowInventario =
        inventarioIndex + 2;

      const colCantidad =
        inventarioIdx.get(
          normKey(
            "cantidadDisponible"
          )
        );

      const colFecha =
        inventarioIdx.get(
          normKey(
            "fechaUltimoMovimiento"
          )
        );

      const colEstado =
        inventarioIdx.get(
          normKey("estado")
        );

      if (
        colCantidad === undefined ||
        colFecha === undefined ||
        colEstado === undefined
      ) {
        throw new Error(
          "Faltan columnas requeridas en InventarioProceso."
        );
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,

        requestBody: {
          valueInputOption:
            "USER_ENTERED",

          data: [
            {
              range:
                `InventarioProceso!${toColLetter(
                  colCantidad
                )}${sheetRowInventario}`,

              values: [
                [saldoFinal],
              ],
            },

            {
              range:
                `InventarioProceso!${toColLetter(
                  colFecha
                )}${sheetRowInventario}`,

              values: [
                [timestamp],
              ],
            },

            {
              range:
                `InventarioProceso!${toColLetter(
                  colEstado
                )}${sheetRowInventario}`,

              values: [
                [estadoInventario],
              ],
            },
          ],
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range:
          "InventarioProceso!A:K",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            [
              inventarioKey, // A
              OPE, // B
              producto, // C
              referencia, // D
              color, // E
              ancho, // F
              acabado, // G
              medidaMm, // H
              saldoFinal, // I
              timestamp, // J
              estadoInventario, // K
            ],
          ],
        },
      });
    }

    /* =======================================================
       10. MARCAR FILA COMO PROCESADA
       ======================================================= */

    const colProcesado =
      cargueIdx.get(
        normKey("procesado")
      );

    const colFechaProcesado =
      cargueIdx.get(
        normKey("fechaProcesado")
      );

    if (
      colProcesado === undefined ||
      colFechaProcesado === undefined
    ) {
      throw new Error(
        "Faltan columnas procesado/fechaProcesado en CargueInicialProceso."
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,

      requestBody: {
        valueInputOption:
          "USER_ENTERED",

        data: [
          {
            range:
              `CargueInicialProceso!${toColLetter(
                colProcesado
              )}${sheetRow}`,

            values: [
              ["SI"],
            ],
          },

          {
            range:
              `CargueInicialProceso!${toColLetter(
                colFechaProcesado
              )}${sheetRow}`,

            values: [
              [timestamp],
            ],
          },
        ],
      },
    });

    /* =======================================================
       RESPUESTA
       ======================================================= */

    return NextResponse.json(
      {
        success: true,

        sheetRow,

        cargueKey,

        movimientoCreado,

        movimientoRelacionado,

        inventarioKey,

        OPE,

        producto,

        medida_mm:
          medidaMm,

        cantidadFisica,

        saldoFinal,

        estadoInventario,

        responsableConteo,

        fechaConteo,

        procesado:
          "SI",

        fechaProcesado:
          timestamp,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[POST control producto proceso - procesar cargue inicial]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "No fue posible procesar el cargue inicial.",
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
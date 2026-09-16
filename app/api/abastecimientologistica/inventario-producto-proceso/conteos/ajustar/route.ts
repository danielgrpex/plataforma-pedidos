import { NextResponse } from "next/server";

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
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const text =
    toStr(value);

  if (!text) {
    return 0;
  }

  if (
    text.includes(",") &&
    text.includes(".")
  ) {
    const n =
      Number(
        text
          .replace(/\./g, "")
          .replace(",", ".")
      );

    return Number.isFinite(n)
      ? n
      : 0;
  }

  if (text.includes(",")) {
    const n =
      Number(
        text.replace(",", ".")
      );

    return Number.isFinite(n)
      ? n
      : 0;
  }

  const n =
    Number(text);

  return Number.isFinite(n)
    ? n
    : 0;
}

function toInt(value: unknown) {
  const n =
    Math.floor(
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
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(value: unknown) {
  return norm(value)
    .replace(/\s+/g, "");
}

function makeId(prefix: string) {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

  return `${prefix}_${timestamp}_${random}`;
}

function buildHeaderIndex(
  header: any[]
) {
  const index =
    new Map<
      string,
      number
    >();

  header.forEach(
    (
      value,
      i
    ) => {
      const key =
        normKey(value);

      if (key) {
        index.set(
          key,
          i
        );
      }
    }
  );

  return index;
}

function pickCell(
  row: any[],
  index: Map<
    string,
    number
  >,
  ...keys: string[]
) {
  for (
    const key of keys
  ) {
    const position =
      index.get(
        normKey(key)
      );

    if (
      position !== undefined
    ) {
      return row[
        position
      ];
    }
  }

  return "";
}

function toColLetter(
  index0: number
) {
  let number =
    index0 + 1;

  let result =
    "";

  while (
    number > 0
  ) {
    const remainder =
      (number - 1) %
      26;

    result =
      String.fromCharCode(
        65 + remainder
      ) + result;

    number =
      Math.floor(
        (number - 1) /
          26
      );
  }

  return result;
}

/* =========================================================
   BODY
   ========================================================= */

type Body = {
  conteoKey?: string;
  usuarioAjuste?: string;
};

/* =========================================================
   POST

   Aplica el ajuste correspondiente a un conteo.

   REGLAS:
   - Solo procesa "Pendiente ajuste".
   - No confía en la diferencia enviada desde UI.
   - Relee el conteo desde Sheets.
   - Recalcula saldo desde MovimientosProceso.
   - Bloquea si hubo movimientos después del conteo.
   - Genera AJUSTE_INVENTARIO.
   - Actualiza InventarioProceso.
   - Marca ConteosInventarioProceso como Ajustado.
   - Es idempotente.
   ========================================================= */

export async function POST(
  req: Request
) {
  try {
    const body =
      (await req.json()) as Body;

    const conteoKey =
      toStr(
        body.conteoKey
      );

    const usuarioAjuste =
      toStr(
        body.usuarioAjuste
      ) ||
      "usuario-no-identificado";

    if (!conteoKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El conteoKey es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const sheets =
      await getSheetsClient();

    const spreadsheetId =
      env.SHEET_BASE_PRINCIPAL_ID;

    const timestamp =
      new Date().toISOString();

    /* =====================================================
       1. LEER CONTEOS, MOVIMIENTOS E INVENTARIO
       ===================================================== */

    const [
      conteosResp,
      movimientosResp,
      inventarioResp,
    ] =
      await Promise.all([
        sheets.spreadsheets.values.get(
          {
            spreadsheetId,

            range:
              "ConteosInventarioProceso!A:T",

            valueRenderOption:
              "UNFORMATTED_VALUE",
          }
        ),

        sheets.spreadsheets.values.get(
          {
            spreadsheetId,

            range:
              "MovimientosProceso!A:U",

            valueRenderOption:
              "UNFORMATTED_VALUE",
          }
        ),

        sheets.spreadsheets.values.get(
          {
            spreadsheetId,

            range:
              "InventarioProceso!A:K",

            valueRenderOption:
              "UNFORMATTED_VALUE",
          }
        ),
      ]);

    const conteosValues =
      (conteosResp.data.values ||
        []) as any[][];

    const movimientosValues =
      (movimientosResp.data.values ||
        []) as any[][];

    const inventarioValues =
      (inventarioResp.data.values ||
        []) as any[][];

    if (
      conteosValues.length <
      2
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No existen conteos registrados.",
        },
        {
          status: 404,
        }
      );
    }

    /* =====================================================
       2. LOCALIZAR CONTEO
       ===================================================== */

    const conteosHeader =
      conteosValues[0] ||
      [];

    const conteosRows =
      conteosValues.slice(
        1
      );

    const conteosIdx =
      buildHeaderIndex(
        conteosHeader
      );

    const conteoIndex =
      conteosRows.findIndex(
        (row) =>
          toStr(
            pickCell(
              row,
              conteosIdx,
              "conteoKey"
            )
          ) ===
          conteoKey
      );

    if (
      conteoIndex <
      0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No se encontró el conteo solicitado.",
        },
        {
          status: 404,
        }
      );
    }

    const conteoRow =
      conteosRows[
        conteoIndex
      ];

    const conteoSheetRow =
      conteoIndex + 2;

    const fechaConteo =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "fechaConteo"
        )
      );

    const tipoConteo =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "tipoConteo"
        )
      );

    const inventarioKey =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "inventarioKey"
        )
      );

    const OPE =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "OPE"
        )
      );

    const producto =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "producto"
        )
      );

    const referencia =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "referencia"
        )
      );

    const color =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "color"
        )
      );

    const ancho =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "ancho"
        )
      );

    const acabado =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "acabado"
        )
      );

    const medidaMm =
      toInt(
        pickCell(
          conteoRow,
          conteosIdx,
          "medida_mm"
        )
      );

    const cantidadSistemaConteo =
      toNumber(
        pickCell(
          conteoRow,
          conteosIdx,
          "cantidadSistema"
        )
      );

    const cantidadFisica =
      toNumber(
        pickCell(
          conteoRow,
          conteosIdx,
          "cantidadFisica"
        )
      );

    const diferencia =
      toNumber(
        pickCell(
          conteoRow,
          conteosIdx,
          "diferencia"
        )
      );

    const responsableConteo =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "responsableConteo"
        )
      );

    const motivoDiferencia =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "motivoDiferencia"
        )
      );

    const estadoConteo =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "estado"
        )
      );

    const movimientoAjusteKeyExistente =
      toStr(
        pickCell(
          conteoRow,
          conteosIdx,
          "movimientoAjusteKey"
        )
      );

    /* =====================================================
       3. CONTEO YA AJUSTADO

       Respuesta idempotente.
       ===================================================== */

    if (
      norm(
        estadoConteo
      ) ===
      "ajustado"
    ) {
      return NextResponse.json(
        {
          ok: true,

          yaAjustado:
            true,

          conteoKey,

          inventarioKey,

          OPE,

          producto,

          cantidadSistema:
            cantidadSistemaConteo,

          cantidadFisica,

          diferencia,

          estado:
            estadoConteo,

          movimientoAjusteKey:
            movimientoAjusteKeyExistente,

          message:
            "Este conteo ya fue ajustado anteriormente.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =====================================================
       4. VALIDAR ESTADO
       ===================================================== */

    if (
      norm(
        estadoConteo
      ) ===
      "sin diferencia"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Este conteo no requiere ajuste porque no presenta diferencias.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      norm(
        estadoConteo
      ) !==
      "pendiente ajuste"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `El conteo se encuentra en estado "${estadoConteo}" y no puede ajustarse.`,
        },
        {
          status: 409,
        }
      );
    }

    if (
      diferencia === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El conteo no tiene diferencia para ajustar.",
        },
        {
          status: 409,
        }
      );
    }

    /* =====================================================
       5. PREPARAR MOVIMIENTOS
       ===================================================== */

    const movimientosHeader =
      movimientosValues[0] ||
      [];

    const movimientosRows =
      movimientosValues.length >
      1
        ? movimientosValues.slice(
            1
          )
        : [];

    const movimientosIdx =
      buildHeaderIndex(
        movimientosHeader
      );

    const movimientoRelacionado =
      `CONTEO|${conteoKey}`;

    /* =====================================================
       6. IDEMPOTENCIA POR MOVIMIENTO

       Si el movimiento existe pero el conteo no alcanzó
       a marcarse Ajustado por un fallo previo, recuperamos.
       ===================================================== */

    const movimientoExistente =
      movimientosRows.find(
        (mov) => {
          const relacionado =
            toStr(
              pickCell(
                mov,
                movimientosIdx,
                "movimientoRelacionado"
              )
            );

          const estado =
            norm(
              pickCell(
                mov,
                movimientosIdx,
                "estado"
              )
            );

          return (
            relacionado ===
              movimientoRelacionado &&
            estado !==
              "anulado"
          );
        }
      );

    let movimientoAjusteKey =
      movimientoExistente
        ? toStr(
            pickCell(
              movimientoExistente,
              movimientosIdx,
              "movimientoKey"
            )
          )
        : "";

    /* =====================================================
       7. CALCULAR SALDO ACTUAL DESDE KARDEX
       ===================================================== */

    let saldoActual =
      0;

    for (
      const mov of
        movimientosRows
    ) {
      const estado =
        norm(
          pickCell(
            mov,
            movimientosIdx,
            "estado"
          )
        );

      if (
        estado ===
        "anulado"
      ) {
        continue;
      }

      const key =
        toStr(
          pickCell(
            mov,
            movimientosIdx,
            "inventarioKey"
          )
        );

      if (
        key !==
        inventarioKey
      ) {
        continue;
      }

      saldoActual +=
        toNumber(
          pickCell(
            mov,
            movimientosIdx,
            "cantidadMovimiento"
          )
        );
    }

    /* =====================================================
       8. SI EL MOVIMIENTO YA EXISTE

       saldoActual ya incluye el ajuste.
       Solo reparamos InventarioProceso y el conteo.
       ===================================================== */

    if (
      movimientoExistente
    ) {
      await materializarInventario({
        sheets,
        spreadsheetId,
        inventarioValues,
        inventarioKey,
        OPE,
        producto,
        referencia,
        color,
        ancho,
        acabado,
        medidaMm,
        saldoFinal:
          saldoActual,
        timestamp,
      });

      await marcarConteoAjustado({
        sheets,
        spreadsheetId,
        conteosIdx,
        conteoSheetRow,
        movimientoAjusteKey,
        timestamp,
      });

      return NextResponse.json(
        {
          ok: true,

          recuperado:
            true,

          conteoKey,

          movimientoAjusteKey,

          inventarioKey,

          OPE,

          producto,

          cantidadSistema:
            cantidadSistemaConteo,

          cantidadFisica,

          diferencia,

          saldoFinal:
            saldoActual,

          estado:
            "Ajustado",

          message:
            "El movimiento de ajuste ya existía. PEX completó la sincronización del conteo y del inventario.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =====================================================
       9. PROTECCIÓN CONTRA CONTEO DESACTUALIZADO

       Primero verificamos que el saldo actual siga siendo
       igual al saldo observado cuando se hizo el conteo.
       ===================================================== */

    if (
      saldoActual !==
      cantidadSistemaConteo
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "SALDO_CAMBIO_DESDE_CONTEO",

          message:
            "El saldo de PEX cambió después de realizar el conteo. No es seguro aplicar este ajuste; realiza un nuevo conteo físico.",

          conteoKey,

          inventarioKey,

          cantidadSistemaConteo,

          saldoActual,

          cantidadFisica,

          diferenciaConteo:
            diferencia,
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
       10. PROTECCIÓN ADICIONAL:
           MOVIMIENTOS POSTERIORES AL CONTEO

       Incluso si el saldo volvió al mismo valor,
       no ajustamos si hubo actividad después del conteo.
       ===================================================== */

    const fechaConteoMs =
      new Date(
        fechaConteo
      ).getTime();

    if (
      Number.isFinite(
        fechaConteoMs
      )
    ) {
      const movimientoPosterior =
        movimientosRows.find(
          (mov) => {
            const estado =
              norm(
                pickCell(
                  mov,
                  movimientosIdx,
                  "estado"
                )
              );

            if (
              estado ===
              "anulado"
            ) {
              return false;
            }

            const key =
              toStr(
                pickCell(
                  mov,
                  movimientosIdx,
                  "inventarioKey"
                )
              );

            if (
              key !==
              inventarioKey
            ) {
              return false;
            }

            const movTimestamp =
              toStr(
                pickCell(
                  mov,
                  movimientosIdx,
                  "timestamp"
                )
              );

            const movMs =
              new Date(
                movTimestamp
              ).getTime();

            return (
              Number.isFinite(
                movMs
              ) &&
              movMs >
                fechaConteoMs
            );
          }
        );

      if (
        movimientoPosterior
      ) {
        return NextResponse.json(
          {
            ok: false,

            code:
              "MOVIMIENTO_POSTERIOR_AL_CONTEO",

            message:
              "Esta existencia tuvo movimientos después del conteo físico. Por seguridad debes realizar un nuevo conteo antes de ajustar.",

            conteoKey,

            inventarioKey,

            OPE,

            cantidadSistemaConteo,

            saldoActual,

            cantidadFisica,
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
    }

    /* =====================================================
       11. VALIDAR DIFERENCIA ORIGINAL

       Debe seguir correspondiendo a:
       físico - sistema del conteo.
       ===================================================== */

    const diferenciaCalculada =
      cantidadFisica -
      cantidadSistemaConteo;

    if (
      diferenciaCalculada !==
      diferencia
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "CONTEO_INCONSISTENTE",

          message:
            "La diferencia almacenada no coincide con las cantidades del conteo. Revisa el registro antes de continuar.",
        },
        {
          status: 409,
        }
      );
    }

    /* =====================================================
       12. CREAR MOVIMIENTO AJUSTE_INVENTARIO
       ===================================================== */

    movimientoAjusteKey =
      makeId(
        "MOVPP"
      );

    const observacion =
      [
        `Ajuste por conteo ${tipoConteo}`,

        `Conteo: ${conteoKey}`,

        `Sistema al contar: ${cantidadSistemaConteo}`,

        `Físico: ${cantidadFisica}`,

        `Diferencia: ${
          diferencia > 0
            ? "+"
            : ""
        }${diferencia}`,

        responsableConteo
          ? `Responsable conteo: ${responsableConteo}`
          : "",

        motivoDiferencia
          ? `Motivo: ${motivoDiferencia}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");

    await sheets.spreadsheets.values.append(
      {
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
              movimientoAjusteKey, // A movimientoKey
              timestamp, // B timestamp
              "AJUSTE_INVENTARIO", // C tipoMovimiento
              OPE, // D OPE
              "", // E OTE
              "", // F consecutivoCorte
              producto, // G producto
              referencia, // H referencia
              color, // I color
              ancho, // J ancho
              acabado, // K acabado
              medidaMm, // L medida_mm
              diferencia, // M cantidadMovimiento
              inventarioKey, // N inventarioKey
              "", // O transformacionKey
              usuarioAjuste, // P usuario
              "", // Q turno
              observacion, // R observacion
              movimientoRelacionado, // S movimientoRelacionado
              "ACTIVO", // T estado
              responsableConteo, // U supervisor / responsable
            ],
          ],
        },
      }
    );

    /* =====================================================
       13. SALDO FINAL
       ===================================================== */

    const saldoFinal =
      saldoActual +
      diferencia;

    /*
     * Debe terminar exactamente igual
     * a la cantidad física contada.
     */
    if (
      saldoFinal !==
      cantidadFisica
    ) {
      throw new Error(
        "El saldo final calculado no coincide con la cantidad física del conteo."
      );
    }

    /* =====================================================
       14. ACTUALIZAR INVENTARIO MATERIALIZADO
       ===================================================== */

    await materializarInventario({
      sheets,
      spreadsheetId,
      inventarioValues,
      inventarioKey,
      OPE,
      producto,
      referencia,
      color,
      ancho,
      acabado,
      medidaMm,
      saldoFinal,
      timestamp,
    });

    /* =====================================================
       15. MARCAR CONTEO COMO AJUSTADO
       ===================================================== */

    await marcarConteoAjustado({
      sheets,
      spreadsheetId,
      conteosIdx,
      conteoSheetRow,
      movimientoAjusteKey,
      timestamp,
    });

    /* =====================================================
       RESPUESTA
       ===================================================== */

    return NextResponse.json(
      {
        ok: true,

        yaAjustado:
          false,

        conteoKey,

        movimientoAjusteKey,

        inventarioKey,

        OPE,

        producto,

        medida_mm:
          medidaMm,

        tipoConteo,

        responsableConteo,

        cantidadSistema:
          cantidadSistemaConteo,

        cantidadFisica,

        diferencia,

        saldoAnterior:
          saldoActual,

        saldoFinal,

        estado:
          "Ajustado",

        usuarioAjuste,

        fechaAjuste:
          timestamp,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[POST ajustar conteo inventario PP]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          error instanceof Error
            ? error.message
            : "No fue posible aplicar el ajuste de inventario.",
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

/* =========================================================
   MATERIALIZAR INVENTARIO

   InventarioProceso NO es la fuente contable.
   Solo refleja el saldo resultante del kardex.
   ========================================================= */

async function materializarInventario(
  params: {
    sheets: Awaited<
      ReturnType<
        typeof getSheetsClient
      >
    >;

    spreadsheetId: string;

    inventarioValues: any[][];

    inventarioKey: string;

    OPE: string;
    producto: string;

    referencia: string;
    color: string;
    ancho: string;
    acabado: string;

    medidaMm: number;

    saldoFinal: number;

    timestamp: string;
  }
) {
  const {
    sheets,
    spreadsheetId,

    inventarioValues,

    inventarioKey,

    OPE,
    producto,

    referencia,
    color,
    ancho,
    acabado,

    medidaMm,

    saldoFinal,

    timestamp,
  } = params;

  const inventarioHeader =
    inventarioValues[0] ||
    [];

  const inventarioRows =
    inventarioValues.length >
    1
      ? inventarioValues.slice(
          1
        )
      : [];

  const inventarioIdx =
    buildHeaderIndex(
      inventarioHeader
    );

  const inventarioIndex =
    inventarioRows.findIndex(
      (row) =>
        toStr(
          pickCell(
            row,
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
    inventarioIndex >=
    0
  ) {
    const sheetRow =
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
        normKey(
          "estado"
        )
      );

    if (
      colCantidad ===
        undefined ||
      colFecha ===
        undefined ||
      colEstado ===
        undefined
    ) {
      throw new Error(
        "Faltan columnas requeridas en InventarioProceso."
      );
    }

    await sheets.spreadsheets.values.batchUpdate(
      {
        spreadsheetId,

        requestBody: {
          valueInputOption:
            "USER_ENTERED",

          data: [
            {
              range:
                `InventarioProceso!${toColLetter(
                  colCantidad
                )}${sheetRow}`,

              values: [
                [
                  saldoFinal,
                ],
              ],
            },

            {
              range:
                `InventarioProceso!${toColLetter(
                  colFecha
                )}${sheetRow}`,

              values: [
                [
                  timestamp,
                ],
              ],
            },

            {
              range:
                `InventarioProceso!${toColLetter(
                  colEstado
                )}${sheetRow}`,

              values: [
                [
                  estadoInventario,
                ],
              ],
            },
          ],
        },
      }
    );

    return;
  }

  /*
   * Caso de recuperación:
   * si por algún motivo la fila materializada desapareció,
   * la reconstruimos con la información del conteo.
   */
  await sheets.spreadsheets.values.append(
    {
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
            inventarioKey,
            OPE,
            producto,
            referencia,
            color,
            ancho,
            acabado,
            medidaMm,
            saldoFinal,
            timestamp,
            estadoInventario,
          ],
        ],
      },
    }
  );
}

/* =========================================================
   MARCAR CONTEO AJUSTADO
   ========================================================= */

async function marcarConteoAjustado(
  params: {
    sheets: Awaited<
      ReturnType<
        typeof getSheetsClient
      >
    >;

    spreadsheetId: string;

    conteosIdx: Map<
      string,
      number
    >;

    conteoSheetRow: number;

    movimientoAjusteKey: string;

    timestamp: string;
  }
) {
  const {
    sheets,
    spreadsheetId,

    conteosIdx,

    conteoSheetRow,

    movimientoAjusteKey,

    timestamp,
  } = params;

  const colEstado =
    conteosIdx.get(
      normKey("estado")
    );

  const colMovimiento =
    conteosIdx.get(
      normKey(
        "movimientoAjusteKey"
      )
    );

  const colFecha =
    conteosIdx.get(
      normKey(
        "fechaAjuste"
      )
    );

  if (
    colEstado ===
      undefined ||
    colMovimiento ===
      undefined ||
    colFecha ===
      undefined
  ) {
    throw new Error(
      "Faltan columnas de ajuste en ConteosInventarioProceso."
    );
  }

  await sheets.spreadsheets.values.batchUpdate(
    {
      spreadsheetId,

      requestBody: {
        valueInputOption:
          "USER_ENTERED",

        data: [
          {
            range:
              `ConteosInventarioProceso!${toColLetter(
                colEstado
              )}${conteoSheetRow}`,

            values: [
              [
                "Ajustado",
              ],
            ],
          },

          {
            range:
              `ConteosInventarioProceso!${toColLetter(
                colMovimiento
              )}${conteoSheetRow}`,

            values: [
              [
                movimientoAjusteKey,
              ],
            ],
          },

          {
            range:
              `ConteosInventarioProceso!${toColLetter(
                colFecha
              )}${conteoSheetRow}`,

            values: [
              [
                timestamp,
              ],
            ],
          },
        ],
      },
    }
  );
}
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

/* =========================================================
   BODY POST
   ========================================================= */

type Body = {
  inventarioKey?: string;

  tipoConteo?: string;

  cantidadFisica?: number;

  responsableConteo?: string;

  motivoDiferencia?: string;

  usuarioSistema?: string;
};

/* =========================================================
   GET

   Consulta el historial de conteos.
   ========================================================= */

export async function GET() {
  try {
    const sheets =
      await getSheetsClient();

    const spreadsheetId =
      env.SHEET_BASE_PRINCIPAL_ID;

    const resp =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId,

          range:
            "ConteosInventarioProceso!A:T",

          valueRenderOption:
            "UNFORMATTED_VALUE",
        }
      );

    const values =
      (resp.data.values ||
        []) as any[][];

    if (!values.length) {
      return NextResponse.json(
        {
          ok: true,
          total: 0,
          conteos: [],
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const header =
      values[0] || [];

    const rows =
      values.length > 1
        ? values.slice(1)
        : [];

    const idx =
      buildHeaderIndex(
        header
      );

    const conteos =
      rows
        .map(
          (
            row,
            index
          ) => ({
            sheetRow:
              index + 2,

            conteoKey:
              toStr(
                pickCell(
                  row,
                  idx,
                  "conteoKey"
                )
              ),

            fechaConteo:
              toStr(
                pickCell(
                  row,
                  idx,
                  "fechaConteo"
                )
              ),

            tipoConteo:
              toStr(
                pickCell(
                  row,
                  idx,
                  "tipoConteo"
                )
              ),

            inventarioKey:
              toStr(
                pickCell(
                  row,
                  idx,
                  "inventarioKey"
                )
              ),

            OPE:
              toStr(
                pickCell(
                  row,
                  idx,
                  "OPE"
                )
              ),

            producto:
              toStr(
                pickCell(
                  row,
                  idx,
                  "producto"
                )
              ),

            referencia:
              toStr(
                pickCell(
                  row,
                  idx,
                  "referencia"
                )
              ),

            color:
              toStr(
                pickCell(
                  row,
                  idx,
                  "color"
                )
              ),

            ancho:
              toStr(
                pickCell(
                  row,
                  idx,
                  "ancho"
                )
              ),

            acabado:
              toStr(
                pickCell(
                  row,
                  idx,
                  "acabado"
                )
              ),

            medida_mm:
              toInt(
                pickCell(
                  row,
                  idx,
                  "medida_mm"
                )
              ),

            cantidadSistema:
              toNumber(
                pickCell(
                  row,
                  idx,
                  "cantidadSistema"
                )
              ),

            cantidadFisica:
              toNumber(
                pickCell(
                  row,
                  idx,
                  "cantidadFisica"
                )
              ),

            diferencia:
              toNumber(
                pickCell(
                  row,
                  idx,
                  "diferencia"
                )
              ),

            responsableConteo:
              toStr(
                pickCell(
                  row,
                  idx,
                  "responsableConteo"
                )
              ),

            usuarioSistema:
              toStr(
                pickCell(
                  row,
                  idx,
                  "usuarioSistema"
                )
              ),

            motivoDiferencia:
              toStr(
                pickCell(
                  row,
                  idx,
                  "motivoDiferencia"
                )
              ),

            estado:
              toStr(
                pickCell(
                  row,
                  idx,
                  "estado"
                )
              ),

            movimientoAjusteKey:
              toStr(
                pickCell(
                  row,
                  idx,
                  "movimientoAjusteKey"
                )
              ),

            fechaAjuste:
              toStr(
                pickCell(
                  row,
                  idx,
                  "fechaAjuste"
                )
              ),
          })
        )
        .filter(
          (item) =>
            item.conteoKey
        )
        .reverse();

    return NextResponse.json(
      {
        ok: true,

        total:
          conteos.length,

        conteos,
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
      "[GET conteos inventario PP]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los conteos.",
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
   POST

   Registra UN conteo físico.

   IMPORTANTE:
   - NO modifica InventarioProceso.
   - NO genera todavía AJUSTE_INVENTARIO.
   - Obtiene cantidadSistema desde MovimientosProceso.
   ========================================================= */

export async function POST(
  req: Request
) {
  try {
    const body =
      (await req.json()) as Body;

    const inventarioKey =
      toStr(
        body.inventarioKey
      );

    const tipoConteo =
      toStr(
        body.tipoConteo
      );

    const cantidadFisica =
      toInt(
        body.cantidadFisica
      );

    const responsableConteo =
      toStr(
        body.responsableConteo
      );

    const usuarioSistema =
      toStr(
        body.usuarioSistema
      ) ||
      "usuario-no-identificado";

    const motivoDiferencia =
      toStr(
        body.motivoDiferencia
      );

    /* =====================================================
       VALIDACIONES BÁSICAS
       ===================================================== */

    if (!inventarioKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El inventarioKey es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      ![
        "semanal",
        "mensual",
        "extraordinario",
      ].includes(
        norm(tipoConteo)
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El tipo de conteo debe ser Semanal, Mensual o Extraordinario.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.cantidadFisica ===
        undefined ||
      body.cantidadFisica ===
        null ||
      toNumber(
        body.cantidadFisica
      ) < 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La cantidad física debe ser 0 o mayor.",
        },
        {
          status: 400,
        }
      );
    }

    if (!responsableConteo) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El responsable del conteo es obligatorio.",
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
       1. LEER INVENTARIO Y MOVIMIENTOS
       ===================================================== */

    const [
      inventarioResp,
      movimientosResp,
    ] =
      await Promise.all([
        sheets.spreadsheets.values.get(
          {
            spreadsheetId,

            range:
              "InventarioProceso!A:K",

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
      ]);

    const inventarioValues =
      (inventarioResp.data
        .values ||
        []) as any[][];

    const movimientosValues =
      (movimientosResp.data
        .values ||
        []) as any[][];

    if (
      inventarioValues.length <
      2
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No existe inventario disponible para realizar el conteo.",
        },
        {
          status: 404,
        }
      );
    }

    /* =====================================================
       2. LOCALIZAR EXISTENCIA
       ===================================================== */

    const inventarioHeader =
      inventarioValues[0] ||
      [];

    const inventarioRows =
      inventarioValues.slice(1);

    const inventarioIdx =
      buildHeaderIndex(
        inventarioHeader
      );

    const inventarioRow =
      inventarioRows.find(
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

    if (!inventarioRow) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La existencia seleccionada ya no está disponible en InventarioProceso.",
        },
        {
          status: 404,
        }
      );
    }

    const OPE =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "OPE"
        )
      );

    const producto =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "producto"
        )
      );

    const referencia =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "referencia"
        )
      );

    const color =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "color"
        )
      );

    const ancho =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "ancho"
        )
      );

    const acabado =
      toStr(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "acabado"
        )
      );

    const medidaMm =
      toInt(
        pickCell(
          inventarioRow,
          inventarioIdx,
          "medida_mm"
        )
      );

    /* =====================================================
       3. CALCULAR SALDO REAL DESDE EL KARDEX

       MovimientosProceso es la verdad contable.
       InventarioProceso es el saldo materializado.
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

    let cantidadSistema =
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

      cantidadSistema +=
        toNumber(
          pickCell(
            mov,
            movimientosIdx,
            "cantidadMovimiento"
          )
        );
    }

    /* =====================================================
       4. DIFERENCIA

       Físico - Sistema
       ===================================================== */

    const diferencia =
      cantidadFisica -
      cantidadSistema;

    /* =====================================================
       5. MOTIVO OBLIGATORIO CUANDO HAY DIFERENCIA
       ===================================================== */

    if (
      diferencia !== 0 &&
      !motivoDiferencia
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Debes registrar el motivo de la diferencia antes de guardar el conteo.",

          cantidadSistema,

          cantidadFisica,

          diferencia,
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       6. ESTADO INICIAL DEL CONTEO
       ===================================================== */

    const estado =
      diferencia === 0
        ? "Sin diferencia"
        : "Pendiente ajuste";

    const conteoKey =
      makeId("CONT");

    /* =====================================================
       7. GUARDAR CONTEO

       A:T según los encabezados creados.
       ===================================================== */

    await sheets.spreadsheets.values.append(
      {
        spreadsheetId,

        range:
          "ConteosInventarioProceso!A:T",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            [
              conteoKey, // A conteoKey
              timestamp, // B fechaConteo
              tipoConteo, // C tipoConteo
              inventarioKey, // D inventarioKey
              OPE, // E OPE
              producto, // F producto
              referencia, // G referencia
              color, // H color
              ancho, // I ancho
              acabado, // J acabado
              medidaMm, // K medida_mm
              cantidadSistema, // L cantidadSistema
              cantidadFisica, // M cantidadFisica
              diferencia, // N diferencia
              responsableConteo, // O responsableConteo
              usuarioSistema, // P usuarioSistema
              motivoDiferencia, // Q motivoDiferencia
              estado, // R estado
              "", // S movimientoAjusteKey
              "", // T fechaAjuste
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

        conteoKey,

        fechaConteo:
          timestamp,

        tipoConteo,

        inventarioKey,

        OPE,

        producto,

        medida_mm:
          medidaMm,

        cantidadSistema,

        cantidadFisica,

        diferencia,

        responsableConteo,

        usuarioSistema,

        motivoDiferencia,

        estado,

        requiereAjuste:
          diferencia !== 0,

        inventarioModificado:
          false,
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
      "[POST conteo inventario PP]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          error instanceof Error
            ? error.message
            : "No fue posible registrar el conteo.",
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
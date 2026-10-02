import { NextResponse } from "next/server";

import { env } from "@/lib/config/env";

import {
  getInfoSheetRange,
  getSheetsClient,
} from "@/lib/google/googleSheets";

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
  const n = Number(value ?? 0);

  return Number.isFinite(n)
    ? n
    : 0;
}

function norm(value: unknown) {
  return toStr(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(value: unknown) {
  return norm(value)
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function buildHeaderIndex(
  header: any[]
) {
  const map =
    new Map<
      string,
      number
    >();

  header.forEach(
    (value, index) => {
      const key =
        normKey(value);

      if (key) {
        map.set(
          key,
          index
        );
      }
    }
  );

  return map;
}

function pickCell(
  row: any[],
  idx: Map<
    string,
    number
  >,
  ...keys: string[]
) {
  for (
    const key of keys
  ) {
    const index =
      idx.get(
        normKey(key)
      );

    if (
      index !==
      undefined
    ) {
      return row[index];
    }
  }

  return "";
}

function parseLengthToMm(
  value: unknown
) {
  const text =
    toStr(value)
      .toLowerCase()
      .replace(",", ".");

  const match =
    text.match(
      /(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i
    );

  if (!match) {
    return 0;
  }

  const number =
    Number(match[1]);

  const unit =
    match[2].toLowerCase();

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  if (unit === "mm") {
    return Math.round(
      number
    );
  }

  if (unit === "cm") {
    return Math.round(
      number * 10
    );
  }

  if (unit === "m") {
    return Math.round(
      number * 1000
    );
  }

  return 0;
}

function parseProducto(
  producto: unknown
) {
  const raw =
    toStr(producto);

  const partes =
    raw
      .split("|")
      .map(
        (parte) =>
          parte.trim()
      );

  const referencia =
    partes[0] || "";

  const color =
    partes[1] || "";

  const ancho =
    partes[2] || "";

  let largo =
    partes[3] || "";

  if (
    !parseLengthToMm(
      largo
    )
  ) {
    const posible =
      partes.find(
        (parte) =>
          /^\d+(?:[.,]\d+)?\s*(mm|cm|m)$/i.test(
            parte
          )
      );

    if (posible) {
      largo =
        posible;
    }
  }

  return {
    raw,
    referencia,
    color,
    ancho,

    medidaMm:
      parseLengthToMm(
        largo
      ),

    acabado:
      partes.length >= 5
        ? partes
            .slice(4)
            .join(" | ")
        : "",
  };
}

function referenciaBase(
  producto: unknown
) {
  return (
    toStr(producto)
      .split("|")[0]
      ?.trim() || ""
  );
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  request: Request
) {
  try {
    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const solicitudCorteId =
      toStr(
        searchParams.get(
          "solicitudCorteId"
        )
      );

    if (
      !solicitudCorteId
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "solicitudCorteId requerido.",
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

    /* =====================================================
       1. LEER SOLICITUD DE CORTE
       ===================================================== */

    const corteResp =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId,

          range:
            "SolicitudesCorte!A:P",

          valueRenderOption:
            "UNFORMATTED_VALUE",
        }
      );

    const corteValues =
      (
        corteResp.data.values ||
        []
      ) as any[][];

    if (
      corteValues.length <
      2
    ) {
      throw new Error(
        "No hay información en SolicitudesCorte."
      );
    }

    const corteHeader =
      corteValues[0] || [];

    const corteRows =
      corteValues.slice(
        1
      );

    const corteIdx =
      buildHeaderIndex(
        corteHeader
      );

    const corteIndex =
      corteRows.findIndex(
        (row) =>
          toStr(
            pickCell(
              row,
              corteIdx,
              "solicitudCorteId"
            )
          ) ===
          solicitudCorteId
      );

    if (
      corteIndex < 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "La solicitud de corte no existe.",
        },
        {
          status: 404,
        }
      );
    }

    const corteRow =
      corteRows[
        corteIndex
      ];

    const productoSolicitado =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "productoSolicitado"
        )
      );

    const cantidadSolicitadaUnd =
      toNumber(
        pickCell(
          corteRow,
          corteIdx,
          "cantidadSolicitadaUnd"
        )
      );

    const OTE =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "OTE"
        )
      );

    const rowIndexPedido =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "rowIndexPedido"
        )
      );

    const productoFinal =
      parseProducto(
        productoSolicitado
      );

    /* =====================================================
       2. LEER COMPOSICIÓN
       ===================================================== */

    const composicionValues =
  await getInfoSheetRange(
    "ComposicionEmpaque!A:G"
  );

    const composicionRows =
      Array.isArray(
        composicionValues
      )
        ? composicionValues.slice(
            1
          )
        : [];

    const productoFinalBase =
      referenciaBase(
        productoSolicitado
      );

    const composicion =
      composicionRows
        .map(
          (
            row,
            index
          ) => {
            const producto =
  toStr(row?.[0]);

const componente =
  toStr(row?.[1]);

const factor =
  Number(
    String(
      row?.[2] ?? ""
    )
      .trim()
      .replace(",", ".")
  );

const colorComponente =
  toStr(row?.[3]);

const anchoComponente =
  toStr(row?.[4]);

const largoComponente =
  toStr(row?.[5]);

const acabadoComponente =
  toStr(row?.[6]);

            if (
              !producto ||
              !componente ||
              !Number.isFinite(
                factor
              ) ||
              factor <= 0
            ) {
              return null;
            }

            return {
  sheetRow:
    index + 2,

  productoFinal:
    producto,

  componente,

  factorPorUnidad:
    factor,

  colorComponente,

  anchoComponente,

  largoComponente,

  acabadoComponente,
};
          }
        )
        .filter(Boolean)
        .filter(
          (item) =>
            norm(
              item!
                .productoFinal
            ) ===
            norm(
              productoFinalBase
            )
        );

    if (
      !composicion.length
    ) {
      return NextResponse.json(
        {
          ok: true,

          solicitudCorteId,

          OTE,

          rowIndexPedido,

          productoSolicitado,

          cantidadSolicitadaUnd,

          tieneComposicion:
            false,

          componentes: [],
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
       3. LEER INVENTARIO PP
       ===================================================== */

    const invResp =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId,

          range:
            "InventarioProceso!A:K",

          valueRenderOption:
            "UNFORMATTED_VALUE",
        }
      );

    const invValues =
      (
        invResp.data.values ||
        []
      ) as any[][];

    const invHeader =
      invValues[0] || [];

    const invRows =
      invValues.length > 1
        ? invValues.slice(1)
        : [];

    const invIdx =
      buildHeaderIndex(
        invHeader
      );

    /* =====================================================
       4. BUSCAR LOTES POR COMPONENTE

       Se conserva del producto final:
       - color
       - ancho
       - medida mínima

       Cambia únicamente la referencia:
       - componente configurado
       ===================================================== */

    const componentes =
      composicion.map(
        (config) => {
          const componente =
            config!;

            /*
 * Un componente puede tener características
 * propias distintas al producto final.
 *
 * Si el maestro deja el campo vacío,
 * heredamos el valor del producto final.
 */

const colorObjetivo =
  componente.colorComponente ||
  productoFinal.color;

const anchoObjetivo =
  componente.anchoComponente ||
  productoFinal.ancho;

const medidaObjetivoMm =
  parseLengthToMm(
    componente.largoComponente
  ) ||
  productoFinal.medidaMm;

const acabadoObjetivo =
  componente.acabadoComponente ||
  productoFinal.acabado;

          const lotes =
            invRows
              .map(
                (
                  row,
                  index
                ) => {
                  const inventarioKey =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "inventarioKey"
                      )
                    );

                  const OPEInventario =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "OPE"
                      )
                    );

                  const producto =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "producto"
                      )
                    );

                  const referencia =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "referencia"
                      )
                    );

                  const color =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "color"
                      )
                    );

                  const ancho =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "ancho"
                      )
                    );

                  const acabado =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "acabado"
                      )
                    );

                  const medidaMm =
                    toNumber(
                      pickCell(
                        row,
                        invIdx,
                        "medida_mm",
                        "medidaMm"
                      )
                    );

                  const cantidadDisponible =
                    toNumber(
                      pickCell(
                        row,
                        invIdx,
                        "cantidadDisponible"
                      )
                    );

                  const fechaUltimoMovimiento =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "fechaUltimoMovimiento"
                      )
                    );

                  const estado =
                    toStr(
                      pickCell(
                        row,
                        invIdx,
                        "estado"
                      )
                    );

                  const productoParsed =
                    parseProducto(
                      producto
                    );

                  /*
                   * Preferimos columna referencia.
                   * Si está vacía, usamos primera parte de producto.
                   */
                  const referenciaReal =
                    referencia ||
                    productoParsed.referencia;

                  const colorReal =
                    color ||
                    productoParsed.color;

                  const anchoReal =
                    ancho ||
                    productoParsed.ancho;

                  const medidaReal =
                    medidaMm ||
                    productoParsed.medidaMm;

                  const acabadoReal =
  acabado ||
  productoParsed.acabado;  

                  const compatible =
  /*
   * Referencia:
   * debe ser exactamente el componente
   * configurado en ComposicionEmpaque.
   */
  norm(
    referenciaReal
  ) ===
    norm(
      componente.componente
    ) &&

  /*
   * Color:
   * propio del componente o heredado.
   */
  norm(
    colorReal
  ) ===
    norm(
      colorObjetivo
    ) &&

  /*
   * Ancho:
   * propio del componente o heredado.
   */
  norm(
    anchoReal
  ) ===
    norm(
      anchoObjetivo
    ) &&

  /*
   * Largo:
   * puede ser igual o superior al requerido.
   */
  medidaReal >=
    medidaObjetivoMm &&

  /*
   * Acabado:
   * propio del componente o heredado.
   */
  (
    !acabadoObjetivo ||
    norm(
      acabadoReal
    ) ===
      norm(
        acabadoObjetivo
      )
  ) &&

  cantidadDisponible >
    0 &&

  norm(
    estado
  ) !==
    "agotado";

                  if (
                    !compatible
                  ) {
                    return null;
                  }

                  return {
                    sheetRow:
                      index + 2,

                    inventarioKey,

                    OPE:
                      OPEInventario,

                    producto,

                    referencia:
                      referenciaReal,

                    color:
                      colorReal,

                    ancho:
                      anchoReal,

                    acabado:
  acabadoReal,

                    medida_mm:
                      medidaReal,

                    cantidadDisponible,

                    fechaUltimoMovimiento,

                    estado,
                  };
                }
              )
              .filter(Boolean)
              .sort(
                (
                  a,
                  b
                ) => {
                  const fechaA =
                    new Date(
                      a!
                        .fechaUltimoMovimiento ||
                        0
                    ).getTime();

                  const fechaB =
                    new Date(
                      b!
                        .fechaUltimoMovimiento ||
                        0
                    ).getTime();

                  /*
                   * FIFO visual:
                   * primero el lote más antiguo.
                   */
                  return (
                    fechaA -
                    fechaB
                  );
                }
              );

          const necesarioTeorico =
            cantidadSolicitadaUnd *
            componente.factorPorUnidad;

          const totalDisponible =
            lotes.reduce(
              (
                total,
                lote
              ) =>
                total +
                Number(
                  lote!
                    .cantidadDisponible ||
                    0
                ),
              0
            );

          return {
  productoFinal:
    componente.productoFinal,

  componente:
    componente.componente,

  factorPorUnidad:
    componente.factorPorUnidad,

  criterioComponente: {
    color:
      colorObjetivo,

    ancho:
      anchoObjetivo,

    medida_mm:
      medidaObjetivoMm,

    acabado:
      acabadoObjetivo,
  },

  cantidadFinalSolicitada:
    cantidadSolicitadaUnd,

  necesarioTeorico,

  totalDisponible,

  cubreNecesidad:
    totalDisponible >=
    necesarioTeorico,

  cantidadLotes:
    lotes.length,

  lotes,
};
        }
      );

    /* =====================================================
       5. RESPUESTA
       ===================================================== */

    return NextResponse.json(
      {
        ok: true,

        solicitudCorteId,

        OTE,

        rowIndexPedido,

        productoSolicitado,

        cantidadSolicitadaUnd,

        productoObjetivo: {
          referencia:
            productoFinal.referencia,

          color:
            productoFinal.color,

          ancho:
            productoFinal.ancho,

          medidaFinal_mm:
            productoFinal.medidaMm,

          acabadoFinal:
            productoFinal.acabado,
        },

        tieneComposicion:
          true,

        totalComponentes:
          componentes.length,

        todosCubiertos:
          componentes.every(
            (item) =>
              item.cubreNecesidad
          ),

        componentes,
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
      "[inventario-componentes]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los componentes.",
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
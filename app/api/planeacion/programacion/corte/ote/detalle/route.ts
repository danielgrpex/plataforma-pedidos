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

function normHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = toStr(value);

  if (!raw) {
    return 0;
  }

  /*
   * Para cantidades:
   * 2.000 -> 2000
   * 2,000 -> 2
   * 2000  -> 2000
   *
   * Normalmente Sheets entrega numbers porque usamos
   * UNFORMATTED_VALUE.
   */
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(normalized);

  return Number.isFinite(n) ? n : 0;
}

function getColumnIndex(
  headers: unknown[],
  candidates: string[]
) {
  const normalizedHeaders = headers.map(normHeader);

  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(
      normHeader(candidate)
    );

    if (idx >= 0) {
      return idx;
    }
  }

  return -1;
}

function getValue(
  headers: unknown[],
  row: unknown[],
  candidates: string[]
) {
  const idx = getColumnIndex(
    headers,
    candidates
  );

  if (idx < 0) {
    return "";
  }

  return row?.[idx] ?? "";
}

function parseProducto(producto: string) {
  const partes = String(producto || "")
    .split("|")
    .map((x) => x.trim());

  return {
    referencia: partes[0] || "",
    color: partes[1] || "",
    ancho: partes[2] || "",
    largo: partes[3] || "",
    acabado: partes[4] || "",
  };
}

/*
 * pedidoKey actualmente tiene estructura:
 *
 * Cliente | Dirección | OC
 *
 * Ejemplo:
 * Farmatodo Colombia S.A|Calle 140 # 13-27 - Bogota.|26-0948
 *
 * Lo usamos como respaldo por si alguna de esas columnas
 * no viene disponible directamente desde Pedidos.
 */
function parsePedidoKey(pedidoKey: string) {
  const partes = String(pedidoKey || "")
    .split("|")
    .map((x) => x.trim());

  return {
    cliente: partes[0] || "",
    direccion: partes[1] || "",
    oc: partes[2] || "",
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const ote = toStr(
      url.searchParams.get("ote")
    );

    if (!ote) {
      return NextResponse.json(
        {
          success: false,
          message: "Parámetro ote requerido.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const sheets =
      await getSheetsClient();

    /* =====================================================
       1. LEER SOLICITUDES CORTE
       ===================================================== */

    const corteResp =
      await sheets.spreadsheets.values.get({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "SolicitudesCorte!A:P",

        valueRenderOption:
          "UNFORMATTED_VALUE",
      });

    const corteValues =
      (corteResp.data.values ||
        []) as unknown[][];

    if (
      corteValues.length <= 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SolicitudesCorte está vacía.",
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

    const corteHeaders =
      corteValues[0];

    const corteRows =
      corteValues.slice(1);

    /* =====================================================
       ÍNDICES SOLICITUDESCORTE
       ===================================================== */

    const idxSolicitud =
      getColumnIndex(
        corteHeaders,
        ["solicitudCorteId"]
      );

    const idxPedidoKey =
      getColumnIndex(
        corteHeaders,
        ["pedidoKey"]
      );

    const idxRowPedido =
      getColumnIndex(
        corteHeaders,
        ["rowIndexPedido"]
      );

    const idxProducto =
      getColumnIndex(
        corteHeaders,
        ["productoSolicitado"]
      );

    const idxCantidad =
      getColumnIndex(
        corteHeaders,
        ["cantidadSolicitadaUnd"]
      );

    const idxInventarioOrigen =
      getColumnIndex(
        corteHeaders,
        ["inventarioOrigenId"]
      );

    const idxProductoOrigen =
      getColumnIndex(
        corteHeaders,
        ["productoOrigen"]
      );

    const idxLargoOrigen =
      getColumnIndex(
        corteHeaders,
        ["largoOrigen"]
      );

    const idxCantidadOrigen =
      getColumnIndex(
        corteHeaders,
        ["cantidadOrigenUnd"]
      );

    const idxLargoFinal =
      getColumnIndex(
        corteHeaders,
        ["largoFinal"]
      );

    const idxActividades =
      getColumnIndex(
        corteHeaders,
        ["actividades"]
      );

    const idxCantidadResultante =
      getColumnIndex(
        corteHeaders,
        ["cantidadResultanteUnd"]
      );

    const idxEstado =
      getColumnIndex(
        corteHeaders,
        ["estadoitem"]
      );

    const idxFechaCreacion =
      getColumnIndex(
        corteHeaders,
        ["fechaCreacion"]
      );

    const idxUsuario =
      getColumnIndex(
        corteHeaders,
        ["usuario"]
      );

    const idxOTE =
      getColumnIndex(
        corteHeaders,
        ["OTE"]
      );

    /*
     * Estos son los campos mínimos necesarios
     * para poder construir el detalle de una OTE.
     */
    if (
      idxSolicitud < 0 ||
      idxPedidoKey < 0 ||
      idxRowPedido < 0 ||
      idxProducto < 0 ||
      idxCantidad < 0 ||
      idxOTE < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SolicitudesCorte no tiene todos los encabezados requeridos.",
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
       2. FILTRAR SOLICITUDES POR OTE
       ===================================================== */

    const solicitudesOTE =
      corteRows
        .map((row, index) => ({
          row,
          sheetRow:
            index + 2,
        }))
        .filter(
          ({ row }) =>
            toStr(
              row[idxOTE]
            ).toUpperCase() ===
            ote.toUpperCase()
        );

    if (
      solicitudesOTE.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `No se encontraron ítems para ${ote}.`,
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

    /* =====================================================
       3. OBTENER FILAS DE PEDIDOS RELACIONADAS
       ===================================================== */

    const pedidoRowNumbers =
      Array.from(
        new Set(
          solicitudesOTE
            .map(({ row }) =>
              Number(
                row[
                  idxRowPedido
                ]
              )
            )
            .filter(
              (n) =>
                Number.isInteger(
                  n
                ) &&
                n >= 2
            )
        )
      ).sort(
        (a, b) => a - b
      );

    /*
     * Leemos:
     * - encabezado de Pedidos
     * - únicamente las filas utilizadas por esta OTE
     *
     * No descargamos toda la hoja.
     */
    const pedidosRanges = [
      "Pedidos!1:1",

      ...pedidoRowNumbers.map(
        (rowNumber) =>
          `Pedidos!A${rowNumber}:AZ${rowNumber}`
      ),
    ];

    const pedidosResp =
      await sheets.spreadsheets.values.batchGet({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        ranges:
          pedidosRanges,

        valueRenderOption:
          "UNFORMATTED_VALUE",
      });

    const valueRanges =
      pedidosResp.data
        .valueRanges || [];

    const pedidosHeaders =
      (
        valueRanges[0]
          ?.values?.[0] ||
        []
      ) as unknown[];

    /*
     * Mapa:
     *
     * número real de fila en Pedidos
     * ->
     * contenido de esa fila
     */
    const pedidoRowMap =
      new Map<
        number,
        unknown[]
      >();

    pedidoRowNumbers.forEach(
      (
        rowNumber,
        index
      ) => {
        const row =
          (
            valueRanges[
              index + 1
            ]?.values?.[0] ||
            []
          ) as unknown[];

        pedidoRowMap.set(
          rowNumber,
          row
        );
      }
    );

    /* =====================================================
       4. ARMAR DETALLE COMPLETO DE LA OTE
       ===================================================== */

    const items =
      solicitudesOTE.map(
        ({
          row,
          sheetRow,
        }) => {
          /* -------------------------------------------------
             FILA ORIGINAL DEL PEDIDO
             ------------------------------------------------- */

          const rowIndexPedido =
            Number(
              row[
                idxRowPedido
              ]
            );

          const pedidoRow =
            pedidoRowMap.get(
              rowIndexPedido
            ) || [];

          /* -------------------------------------------------
             PEDIDO KEY
             ------------------------------------------------- */

          const pedidoKey =
            toStr(
              row[
                idxPedidoKey
              ]
            );

          const pedidoKeyPartes =
            parsePedidoKey(
              pedidoKey
            );

          /* -------------------------------------------------
             PRODUCTO
             ------------------------------------------------- */

          const productoSolicitado =
            toStr(
              row[
                idxProducto
              ]
            );

          const productoPartes =
            parseProducto(
              productoSolicitado
            );

          /* -------------------------------------------------
             CONSECUTIVO OPERATIVO
             -------------------------------------------------

             Para este flujo estamos usando rowIndexPedido
             como consecutivo operativo.

             Ejemplo:

             rowIndexPedido = 7265
             consecutivo    = 7265

             Esto evita el desfase que vimos anteriormente
             donde la columna Consecutivo devolvía 7264.
             ------------------------------------------------- */

          const consecutivo =
            String(
              rowIndexPedido
            );

          /* -------------------------------------------------
             CLIENTE
             ------------------------------------------------- */

          const cliente =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                ["Cliente"]
              )
            ) ||
            pedidoKeyPartes.cliente;

          /* -------------------------------------------------
             DIRECCIÓN
             -------------------------------------------------

             Primero buscamos la columna en Pedidos.

             Si no existe o viene vacía, usamos pedidoKey.
             ------------------------------------------------- */

          const direccion =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                [
                  "Dirección",
                  "Direccion",
                ]
              )
            ) ||
            pedidoKeyPartes.direccion;

          /* -------------------------------------------------
             ORDEN DE COMPRA
             ------------------------------------------------- */

          const oc =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                [
                  "OC",
                  "Orden de compra",
                ]
              )
            ) ||
            pedidoKeyPartes.oc;

          /* -------------------------------------------------
             PRODUCTO ORIGINAL EN PEDIDOS
             ------------------------------------------------- */

          const productoPedido =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                [
                  "Producto",
                ]
              )
            );

          /* -------------------------------------------------
             CANTIDAD PEDIDO
             ------------------------------------------------- */

          const cantidadPedido =
            getValue(
              pedidosHeaders,
              pedidoRow,
              [
                "Cantidad und/m",
                "Cantidad UND",
                "Cantidad",
              ]
            );

          /* -------------------------------------------------
             CÓDIGO SIIGO
             -------------------------------------------------

             Si alguno de estos encabezados existe,
             recuperamos el valor.

             Si no existe todavía, queda vacío.
             ------------------------------------------------- */

          const codigoSiigo =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                [
                  "Código SIIGO",
                  "Codigo SIIGO",
                  "codigoSiigo",
                ]
              )
            );

          /* -------------------------------------------------
             FECHA REQUERIDA
             ------------------------------------------------- */

          const fechaRequerida =
            toStr(
              getValue(
                pedidosHeaders,
                pedidoRow,
                [
                  "Fecha requerida",
                  "Fecha Requerida",
                  "fechaRequerida",
                ]
              )
            );

          /* =================================================
             OBJETO FINAL DEL ÍTEM
             ================================================= */

          return {
            /* -----------------------------------------------
               IDENTIFICACIÓN SOLICITUD CORTE
               ----------------------------------------------- */

            solicitudCorteId:
              toStr(
                row[
                  idxSolicitud
                ]
              ),

            sheetRowSolicitudCorte:
              sheetRow,

            /* -----------------------------------------------
               PEDIDO
               ----------------------------------------------- */

            pedidoKey,

            rowIndexPedido,

            consecutivo,

            cliente,

            direccion,

            oc,

            fechaRequerida,

            /* -----------------------------------------------
               PRODUCTO DEL PEDIDO
               ----------------------------------------------- */

            productoPedido,

            cantidadPedido,

            /* -----------------------------------------------
               SOLICITUD CORTE
               ----------------------------------------------- */

            productoSolicitado,

            cantidadSolicitadaUnd:
              toNumber(
                row[
                  idxCantidad
                ]
              ),

            /* -----------------------------------------------
               INVENTARIO ORIGEN
               ----------------------------------------------- */

            inventarioOrigenId:
              idxInventarioOrigen >=
              0
                ? toStr(
                    row[
                      idxInventarioOrigen
                    ]
                  )
                : "",

            productoOrigen:
              idxProductoOrigen >=
              0
                ? toStr(
                    row[
                      idxProductoOrigen
                    ]
                  )
                : "",

            largoOrigen:
              idxLargoOrigen >=
              0
                ? toStr(
                    row[
                      idxLargoOrigen
                    ]
                  )
                : "",

            cantidadOrigenUnd:
              idxCantidadOrigen >=
              0
                ? toNumber(
                    row[
                      idxCantidadOrigen
                    ]
                  )
                : 0,

            /* -----------------------------------------------
               TRANSFORMACIÓN / CORTE
               ----------------------------------------------- */

            largoFinal:
              idxLargoFinal >=
              0
                ? toStr(
                    row[
                      idxLargoFinal
                    ]
                  )
                : "",

            actividades:
              idxActividades >=
              0
                ? toStr(
                    row[
                      idxActividades
                    ]
                  )
                : "",

            cantidadResultanteUnd:
              idxCantidadResultante >=
              0
                ? toNumber(
                    row[
                      idxCantidadResultante
                    ]
                  )
                : 0,

            /* -----------------------------------------------
               ESTADO
               ----------------------------------------------- */

            estadoitem:
              idxEstado >= 0
                ? toStr(
                    row[
                      idxEstado
                    ]
                  )
                : "",

            fechaCreacion:
              idxFechaCreacion >=
              0
                ? toStr(
                    row[
                      idxFechaCreacion
                    ]
                  )
                : "",

            usuario:
              idxUsuario >= 0
                ? toStr(
                    row[
                      idxUsuario
                    ]
                  )
                : "",

            ote:
              toStr(
                row[
                  idxOTE
                ]
              ),

            /* -----------------------------------------------
               PRODUCTO SEPARADO
               PARA PDF / TRAZAS
               ----------------------------------------------- */

            referencia:
              productoPartes.referencia,

            color:
              productoPartes.color,

            ancho:
              productoPartes.ancho,

            largo:
              productoPartes.largo,

            acabado:
              productoPartes.acabado,

            /* -----------------------------------------------
               OTROS
               ----------------------------------------------- */

            codigoSiigo,
          };
        }
      );

    /* =====================================================
       5. RESUMEN OTE
       ===================================================== */

    const pedidosUnicos =
      new Set(
        items.map(
          (item) =>
            item.pedidoKey
        )
      );

    const totalUnidades =
      items.reduce(
        (
          total,
          item
        ) =>
          total +
          item.cantidadSolicitadaUnd,
        0
      );

    /* =====================================================
       6. RESPONSE
       ===================================================== */

    return NextResponse.json(
      {
        success: true,

        ote,

        resumen: {
          totalItems:
            items.length,

          totalPedidos:
            pedidosUnicos.size,

          totalUnidades,
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
      "[GET detalle OTE]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error obteniendo detalle de OTE.",
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
// app/api/comercial/pedidos/detalle/route.ts

import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const EPSILON = 0.000001;

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .replace(/\s/g, "");

  if (!raw) return 0;

  // Formato colombiano:
  // 2.400      -> 2400
  // 835,2      -> 835.2
  // 1.234,56   -> 1234.56

  if (raw.includes(",") && raw.includes(".")) {
    const n = Number(
      raw
        .replace(/\./g, "")
        .replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  if (raw.includes(",")) {
    const n = Number(
      raw.replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  // Detecta puntos usados como separador de miles
  if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    const n = Number(
      raw.replace(/\./g, "")
    );

    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(raw);

  return Number.isFinite(n) ? n : 0;
}

function headerMap(headers: string[]) {
  const m = new Map<string, number>();

  headers.forEach((h, i) => {
    m.set(toStr(h), i);
  });

  return m;
}

function findCol(
  headers: string[],
  candidates: string[],
  fallbackIndex = -1
) {
  const hm = headerMap(headers);

  for (const c of candidates) {
    const idx = hm.get(c);

    if (idx !== undefined) {
      return idx;
    }
  }

  const low = headers.map((h) =>
    h.toLowerCase()
  );

  for (const c of candidates) {
    const i = low.findIndex((h) =>
      h.includes(c.toLowerCase())
    );

    if (i >= 0) {
      return i;
    }
  }

  return fallbackIndex;
}

type MovimientoDespacho = {
  fechaDespacho: string;
  pedidoRowIndex: number;
  cantidadUnd: number;
  usuario: string;
  transporte: string;
  guia: string;
  factura: string;
  remision: string;
  observaciones: string;
};

type HistorialDespacho = {
  fechaDespacho: string;
  cantidadUnd: number;
  registros: number;
  usuario: string;
  transporte: string;
  guia: string;
  factura: string;
  remision: string;
  observaciones: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } =
      new URL(req.url);

    const pedidoKey = toStr(
      searchParams.get("pedidoKey")
    );

    if (!pedidoKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "pedidoKey es requerido",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Leemos:
     *
     * Pedidos   -> información original del pedido
     * Despachos -> movimientos reales acumulados
     */
    const [
      pedidosValues,
      despachosValues,
    ] = await Promise.all([
      getBasePrincipalRange(
        "Pedidos!A:ZZ"
      ),

      getBasePrincipalRange(
        "Despachos!A:ZZ"
      ),
    ]);

    if (
      !pedidosValues ||
      pedidosValues.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No hay datos en la hoja Pedidos",
        },
        {
          status: 404,
        }
      );
    }

    // =========================================================
    // PEDIDOS
    // =========================================================

    const headers = (
      pedidosValues[0] || []
    ).map((h) => toStr(h));

    const dataRows =
      pedidosValues.slice(1);

    const c = {
      consecutivo: findCol(
        headers,
        ["Consecutivo"],
        0
      ),

      fechaSolicitud: findCol(
        headers,
        ["Fecha de Solicitud"],
        1
      ),

      asesor: findCol(
        headers,
        ["Asesor Comercial"],
        2
      ),

      cliente: findCol(
        headers,
        ["Cliente"],
        3
      ),

      direccion: findCol(
        headers,
        [
          "Dirección y ciudad de despacho",
          "Direccion y ciudad de despacho",
          "Dirección",
          "Direccion",
        ],
        4
      ),

      oc: findCol(
        headers,
        [
          "Orden de Compra",
          "OC",
        ],
        5
      ),

      producto: findCol(
        headers,
        ["Producto"],
        6
      ),

      cantidadUnd: findCol(
        headers,
        [
          "Cantidad (und)",
          "Cantidad (Und)",
        ],
        11
      ),

      cantidadM: findCol(
        headers,
        [
          "Cantidad (m)",
          "Cantidad M",
        ],
        12
      ),

      precioUnitario: findCol(
        headers,
        ["Precio Unitario"],
        14
      ),

      fechaRequerida: findCol(
        headers,
        ["Fecha Requerida Cliente"],
        15
      ),

      obsComerciales: findCol(
        headers,
        ["Observaciones Comerciales"],
        16
      ),

      estado: findCol(
        headers,
        ["Estado"],
        23
      ),

      fechaEstimadaEntregaAlmacen:
        findCol(
          headers,
          [
            "Fecha Estimada Entrega Almacén",
            "Fecha Estimada Entrega Almacen",
          ],
          24
        ),

      fechaRealEntregaAlmacen:
        findCol(
          headers,
          [
            "Fecha Real Entrega Almacén",
            "Fecha Real Entrega Almacen",
          ],
          25
        ),

      fechaEstimadaDespacho:
        findCol(
          headers,
          ["Fecha Estimada Despacho"],
          26
        ),

      fechaRealDespacho:
        findCol(
          headers,
          ["Fecha Real Despacho"],
          27
        ),

      transporte: findCol(
        headers,
        ["Transporte"],
        28
      ),

      guia: findCol(
        headers,
        [
          "Guia",
          "Guía",
        ],
        30
      ),

      factura: findCol(
        headers,
        ["Factura"],
        31
      ),

      remision: findCol(
        headers,
        [
          "Remision",
          "Remisión",
        ],
        32
      ),

      fechaEntregaRealCliente:
        findCol(
          headers,
          ["Fecha Entrega Real Cliente"],
          33
        ),

      observacionesDespacho:
        findCol(
          headers,
          ["Observaciones de Despacho"],
          34
        ),

      pdfPath: findCol(
        headers,
        [
          "drive_folder_link",
          "pdfPath",
        ],
        35
      ),

      createdBy: findCol(
        headers,
        [
          "created_by",
          "Creado por",
        ],
        36
      ),

      pedidoKey: findCol(
        headers,
        [
          "pedidoKey",
          "pedidosKey",
          "PedidoKey",
          "PedidosKey",
        ],
        37
      ),

      pedidoId: findCol(
        headers,
        [
          "pedidosId",
          "pedidoId",
        ],
        38
      ),

      usuarioEntregaCliente:
        findCol(
          headers,
          ["Usuario Entrega Cliente"],
          39
        ),

      observacionesEntregaCliente:
        findCol(
          headers,
          ["Observaciones Entrega Cliente"],
          -1
        ),

      soporteEntregaUrl:
        findCol(
          headers,
          ["Soporte Entrega URL"],
          -1
        ),

      soporteEntregaNombre:
        findCol(
          headers,
          ["Soporte Entrega Nombre"],
          -1
        ),

      fechaCargueSoporteEntrega:
        findCol(
          headers,
          [
            "Fecha Cargue Soporte Entrega",
          ],
          -1
        ),
    };

    if (c.pedidoKey < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No pude encontrar la columna pedidoKey en la hoja Pedidos.",
        },
        {
          status: 500,
        }
      );
    }

    /**
     * Conservamos la fila real de Google Sheets.
     *
     * Header = fila 1
     * Primer registro = fila 2
     */
    const matchedRows = dataRows
      .map((row, idx0) => ({
        row,
        pedidoRowIndex:
          idx0 + 2,
      }))
      .filter(
        ({ row }) =>
          toStr(
            row?.[c.pedidoKey]
          ) === pedidoKey
      );

    if (!matchedRows.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            `No se encontró el pedido con pedidoKey: ${pedidoKey}`,
        },
        {
          status: 404,
        }
      );
    }

    // =========================================================
    // DESPACHOS
    // =========================================================

    const desHeaders =
      despachosValues?.length
        ? (
            despachosValues[0] || []
          ).map((h) => toStr(h))
        : [];

    const desRows =
      despachosValues?.length
        ? despachosValues.slice(1)
        : [];

    const d = {
      fecha: findCol(
        desHeaders,
        [
          "fechaDespacho",
          "FechaDespacho",
          "fechaMovimiento",
          "fechaMovimientoISO",
          "fecha",
          "Fecha",
        ],
        -1
      ),

      pedidosKey: findCol(
        desHeaders,
        [
          "pedidosKey",
          "PedidosKey",
          "pedidoKey",
          "PedidoKey",
        ],
        -1
      ),

      pedidoRowIndex: findCol(
        desHeaders,
        [
          "pedidoRowIndex",
          "PedidoRowIndex",
          "rowIndex",
          "RowIndex",
        ],
        -1
      ),

      cantidadUnd: findCol(
        desHeaders,
        [
          "cantidadUnd",
          "cantidadDespachadaUnd",
          "CantidadUnd",
          "CantidadDespachadaUnd",
          "cantidad",
        ],
        -1
      ),

      usuario: findCol(
        desHeaders,
        [
          "usuario",
          "Usuario",
        ],
        -1
      ),

      transporte: findCol(
        desHeaders,
        [
          "transporte",
          "Transporte",
        ],
        -1
      ),

      guia: findCol(
        desHeaders,
        [
          "guia",
          "Guia",
          "guía",
          "Guía",
        ],
        -1
      ),

      factura: findCol(
        desHeaders,
        [
          "factura",
          "Factura",
        ],
        -1
      ),

      remision: findCol(
        desHeaders,
        [
          "remision",
          "Remision",
          "remisión",
          "Remisión",
        ],
        -1
      ),

      observaciones: findCol(
        desHeaders,
        [
          "observaciones",
          "Observaciones",
          "obs",
          "Obs",
        ],
        -1
      ),
    };

    const movimientos: MovimientoDespacho[] =
      [];

    if (
      d.pedidosKey >= 0 &&
      d.pedidoRowIndex >= 0 &&
      d.cantidadUnd >= 0
    ) {
      for (const row of desRows) {
        const key = toStr(
          row[d.pedidosKey]
        );

        if (key !== pedidoKey) {
          continue;
        }

        const pedidoRowIndex =
          Math.floor(
            toNum(
              row[d.pedidoRowIndex]
            )
          );

        const cantidadUnd =
          toNum(
            row[d.cantidadUnd]
          );

        if (
          pedidoRowIndex <= 1 ||
          cantidadUnd <= 0
        ) {
          continue;
        }

        movimientos.push({
          fechaDespacho:
            d.fecha >= 0
              ? toStr(row[d.fecha])
              : "",

          pedidoRowIndex,

          cantidadUnd,

          usuario:
            d.usuario >= 0
              ? toStr(row[d.usuario])
              : "",

          transporte:
            d.transporte >= 0
              ? toStr(row[d.transporte])
              : "",

          guia:
            d.guia >= 0
              ? toStr(row[d.guia])
              : "",

          factura:
            d.factura >= 0
              ? toStr(row[d.factura])
              : "",

          remision:
            d.remision >= 0
              ? toStr(row[d.remision])
              : "",

          observaciones:
            d.observaciones >= 0
              ? toStr(
                  row[
                    d.observaciones
                  ]
                )
              : "",
        });
      }
    }

    // =========================================================
    // ACUMULADO POR ÍTEM
    // =========================================================

    const despachadoPorFila =
      new Map<number, number>();

    for (const mov of movimientos) {
      despachadoPorFila.set(
        mov.pedidoRowIndex,
        (
          despachadoPorFila.get(
            mov.pedidoRowIndex
          ) || 0
        ) + mov.cantidadUnd
      );
    }

    // =========================================================
    // ITEMS
    // =========================================================

    const items = matchedRows.map(
      ({
        row,
        pedidoRowIndex,
      }) => {
        const observacionesEntregaCliente =
          c.observacionesEntregaCliente >=
          0
            ? toStr(
                row[
                  c
                    .observacionesEntregaCliente
                ]
              )
            : toStr(
                row[
                  c.observacionesDespacho
                ]
              );

        const solicitadoUnd =
          toNum(
            row[c.cantidadUnd]
          );

        const despachadoUnd =
          despachadoPorFila.get(
            pedidoRowIndex
          ) || 0;

        const pendienteUnd =
          Math.max(
            0,
            solicitadoUnd -
              despachadoUnd
          );

        return {
          // Relación con Despachos
          pedidoRowIndex,

          // Base
          producto: toStr(
            row[c.producto]
          ),

          cantidadUnd: toStr(
            row[c.cantidadUnd]
          ),

          cantidadM: toStr(
            row[c.cantidadM]
          ),

          estadoItem: toStr(
            row[c.estado]
          ),

          // Resumen despacho por ítem
          solicitadoUnd,
          despachadoUnd,
          pendienteUnd,

          // Fechas
          fechaEstimadaEntregaAlmacen:
            toStr(
              row[
                c
                  .fechaEstimadaEntregaAlmacen
              ]
            ),

          fechaRealEntregaAlmacen:
            toStr(
              row[
                c.fechaRealEntregaAlmacen
              ]
            ),

          fechaEstimadaDespacho:
            toStr(
              row[
                c.fechaEstimadaDespacho
              ]
            ),

          fechaRealDespacho:
            toStr(
              row[
                c.fechaRealDespacho
              ]
            ),

          fechaEntregaRealCliente:
            toStr(
              row[
                c
                  .fechaEntregaRealCliente
              ]
            ),

          // Datos finales en Pedidos
          transporte: toStr(
            row[c.transporte]
          ),

          guia: toStr(
            row[c.guia]
          ),

          factura: toStr(
            row[c.factura]
          ),

          remision: toStr(
            row[c.remision]
          ),

          // Soporte cliente
          soporteEntregaUrl:
            c.soporteEntregaUrl >= 0
              ? toStr(
                  row[
                    c.soporteEntregaUrl
                  ]
                )
              : "",

          soporteEntregaNombre:
            c.soporteEntregaNombre >= 0
              ? toStr(
                  row[
                    c
                      .soporteEntregaNombre
                  ]
                )
              : "",

          fechaCargueSoporteEntrega:
            c
              .fechaCargueSoporteEntrega >=
            0
              ? toStr(
                  row[
                    c
                      .fechaCargueSoporteEntrega
                  ]
                )
              : "",

          usuarioEntregaCliente:
            c.usuarioEntregaCliente >= 0
              ? toStr(
                  row[
                    c
                      .usuarioEntregaCliente
                  ]
                )
              : "",

          observacionesEntregaCliente,

          // Valores
          precioUnitario:
            toStr(
              row[c.precioUnitario]
            ),
        };
      }
    );

    // =========================================================
    // RESUMEN GENERAL DESPACHO
    // =========================================================

    const totalSolicitadoUnd =
      items.reduce(
        (
          acc,
          item
        ) =>
          acc +
          item.solicitadoUnd,
        0
      );

    const totalDespachadoUnd =
      items.reduce(
        (
          acc,
          item
        ) =>
          acc +
          item.despachadoUnd,
        0
      );

    const totalPendienteUnd =
      Math.max(
        0,
        totalSolicitadoUnd -
          totalDespachadoUnd
      );

    const avancePorcentaje =
      totalSolicitadoUnd > 0
        ? Math.min(
            100,
            Math.round(
              (
                totalDespachadoUnd /
                totalSolicitadoUnd
              ) *
                1000
            ) / 10
          )
        : 0;

    let estadoDespacho:
      | "Sin despachos"
      | "Parcial"
      | "Completo";

    if (
      totalDespachadoUnd <=
      EPSILON
    ) {
      estadoDespacho =
        "Sin despachos";
    } else if (
      totalPendienteUnd <=
      EPSILON
    ) {
      estadoDespacho =
        "Completo";
    } else {
      estadoDespacho =
        "Parcial";
    }

    const resumenDespacho = {
      estado: estadoDespacho,
      solicitadoUnd:
        totalSolicitadoUnd,
      despachadoUnd:
        totalDespachadoUnd,
      pendienteUnd:
        totalPendienteUnd,
      avancePorcentaje,
    };

    // =========================================================
    // HISTORIAL DE DESPACHOS
    //
    // Agrupamos las filas de una misma operación.
    // El API de logística usa la misma fecha ISO y los mismos
    // datos generales para todos los ítems del mismo despacho.
    // =========================================================

    const historialMap =
      new Map<
        string,
        HistorialDespacho
      >();

    for (const mov of movimientos) {
      const groupKey = [
        mov.fechaDespacho,
        mov.transporte,
        mov.guia,
        mov.factura,
        mov.remision,
        mov.usuario,
      ].join("|||");

      const current =
        historialMap.get(
          groupKey
        ) || {
          fechaDespacho:
            mov.fechaDespacho,

          cantidadUnd: 0,

          registros: 0,

          usuario:
            mov.usuario,

          transporte:
            mov.transporte,

          guia:
            mov.guia,

          factura:
            mov.factura,

          remision:
            mov.remision,

          observaciones:
            mov.observaciones,
        };

      current.cantidadUnd +=
        mov.cantidadUnd;

      current.registros += 1;

      if (
        !current.observaciones &&
        mov.observaciones
      ) {
        current.observaciones =
          mov.observaciones;
      }

      historialMap.set(
        groupKey,
        current
      );
    }

    const historialDespachos =
      Array.from(
        historialMap.values()
      ).sort((a, b) => {
        const ta = new Date(
          a.fechaDespacho
        ).getTime();

        const tb = new Date(
          b.fechaDespacho
        ).getTime();

        if (
          Number.isNaN(ta) ||
          Number.isNaN(tb)
        ) {
          return a.fechaDespacho.localeCompare(
            b.fechaDespacho
          );
        }

        return ta - tb;
      });

    // =========================================================
    // PEDIDO
    // =========================================================

    const first =
      matchedRows[0].row;

    const itemConSoporte =
      items.find(
        (it) =>
          it.soporteEntregaUrl
      );

    const pedido = {
      pedidoKey:
        toStr(
          first[c.pedidoKey]
        ),

      pedidoId:
        c.pedidoId >= 0
          ? toStr(
              first[c.pedidoId]
            )
          : "",

      consecutivo:
        toStr(
          first[c.consecutivo]
        ),

      fechaSolicitud:
        toStr(
          first[c.fechaSolicitud]
        ),

      asesor:
        toStr(
          first[c.asesor]
        ),

      cliente:
        toStr(
          first[c.cliente]
        ),

      direccion:
        toStr(
          first[c.direccion]
        ),

      oc:
        toStr(
          first[c.oc]
        ),

      fechaRequerida:
        toStr(
          first[c.fechaRequerida]
        ),

      obsComerciales:
        toStr(
          first[c.obsComerciales]
        ),

      estado:
        toStr(
          first[c.estado]
        ),

      pdfPath:
        toStr(
          first[c.pdfPath]
        ),

      createdBy:
        toStr(
          first[c.createdBy]
        ),

      // Nuevo resumen acumulado
      resumenDespacho,

      // Nuevo historial real
      historialDespachos,

      // Soporte entrega cliente
      soporteEntregaUrl:
        itemConSoporte
          ?.soporteEntregaUrl || "",

      soporteEntregaNombre:
        itemConSoporte
          ?.soporteEntregaNombre || "",

      fechaCargueSoporteEntrega:
        itemConSoporte
          ?.fechaCargueSoporteEntrega ||
        "",

      usuarioEntregaCliente:
        itemConSoporte
          ?.usuarioEntregaCliente || "",

      observacionesEntregaCliente:
        itemConSoporte
          ?.observacionesEntregaCliente ||
        "",

      items,
    };

    return NextResponse.json({
      success: true,
      pedido,
    });
  } catch (error) {
    console.error(
      "[pedidos/detalle]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error cargando detalle",
      },
      {
        status: 500,
      }
    );
  }
}
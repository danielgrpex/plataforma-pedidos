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
    const n = Number(
      text.replace(",", ".")
    );

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
    const [
      corteValues,
      transformacionesValues,
    ] = await Promise.all([
      getBasePrincipalRange(
        "SolicitudesCorte!A:P"
      ),

      getBasePrincipalRange(
        "TransformacionesProceso!A:O"
      ),
    ]);

    /* =======================================================
       1. TRANSFORMACIONES ACTIVAS
       Sumamos cuánto se ha obtenido por solicitudCorteId
       ======================================================= */

    const transformaciones =
      rowsWithIndex(
        transformacionesValues
      ).rows;

    const procesadoPorSolicitud =
      new Map<string, number>();

    const operacionesPorSolicitud =
      new Map<string, number>();

    for (const row of transformaciones) {
      const transformacionKey =
        toStr(
          row.transformacionKey ??
            row.transformacionkey
        );

      const solicitudCorteId =
        toStr(
          row.solicitudCorteId ??
            row.solicitudcorteid
        );

      const estado =
        norm(
          row.estado
        );

      const cantidadObtenida =
        toNumber(
          row.cantidadObtenidaUnd ??
            row.cantidadobtenidaund
        );

      /*
       * Ignoramos:
       * - filas sin key
       * - filas sin solicitud
       * - transformaciones anuladas
       */
      if (
        !transformacionKey ||
        !solicitudCorteId ||
        estado === "anulado"
      ) {
        continue;
      }

      procesadoPorSolicitud.set(
        solicitudCorteId,
        (procesadoPorSolicitud.get(
          solicitudCorteId
        ) ?? 0) +
          cantidadObtenida
      );

      operacionesPorSolicitud.set(
        solicitudCorteId,
        (operacionesPorSolicitud.get(
          solicitudCorteId
        ) ?? 0) + 1
      );
    }

    /* =======================================================
       2. SOLICITUDES DE CORTE
       ======================================================= */

    const rows =
      rowsWithIndex(
        corteValues
      ).rows;

    /*
     * Seguimos consultando estado Generada.
     * Todavía NO cambiaremos automáticamente el estado
     * en Google Sheets.
     */
    const generadas = rows
      .filter(
        (row) =>
          norm(
            row.estadoitem ??
              row.estadoItem
          ) === "generada"
      )
      .filter(
        (row) =>
          toStr(
            row.OTE ??
              row.ote
          ) !== ""
      )
      .map((row) => {
        const solicitudCorteId =
          toStr(
            row.solicitudCorteId ??
              row.solicitudcorteid
          );

        const cantidadSolicitadaUnd =
          toNumber(
            row.cantidadSolicitadaUnd ??
              row.cantidadsolicitadaund
          );

        const cantidadProcesadaUnd =
          procesadoPorSolicitud.get(
            solicitudCorteId
          ) ?? 0;

        const cantidadPendienteUnd =
          Math.max(
            0,
            cantidadSolicitadaUnd -
              cantidadProcesadaUnd
          );

        const operacionesRegistradas =
          operacionesPorSolicitud.get(
            solicitudCorteId
          ) ?? 0;

        return {
          sheetRow: row.sheetRow,

          solicitudCorteId,

          pedidoKey: toStr(
            row.pedidoKey ??
              row.pedidokey
          ),

          rowIndexPedido: toStr(
            row.rowIndexPedido ??
              row.rowindexpedido
          ),

          productoSolicitado: toStr(
            row.productoSolicitado ??
              row.productosolicitado
          ),

          cantidadSolicitadaUnd,

          /*
           * NUEVO
           */
          cantidadProcesadaUnd,

          /*
           * NUEVO
           */
          cantidadPendienteUnd,

          /*
           * NUEVO
           */
          operacionesRegistradas,

          /*
           * NUEVO
           * Estado calculado, solo informativo.
           */
          estadoProceso:
            cantidadPendienteUnd <= 0
              ? "Completo"
              : cantidadProcesadaUnd > 0
                ? "Parcial"
                : "Pendiente",

          inventarioOrigenId: toStr(
            row.inventarioOrigenId ??
              row.inventarioorigenid
          ),

          productoOrigen: toStr(
            row.productoOrigen ??
              row.productoorigen
          ),

          largoOrigen: toStr(
            row.largoOrigen ??
              row.largoorigen
          ),

          cantidadOrigenUnd: toNumber(
            row.cantidadOrigenUnd ??
              row.cantidadorigenund
          ),

          largoFinal: toStr(
            row.largoFinal ??
              row.largofinal
          ),

          actividades: toStr(
            row.actividades
          ),

          cantidadResultanteUnd: toNumber(
            row.cantidadResultanteUnd ??
              row.cantidadresultanteund
          ),

          estadoitem: toStr(
            row.estadoitem ??
              row.estadoItem
          ),

          fechaCreacion: toStr(
            row.fechaCreacion ??
              row.fechacreacion
          ),

          usuario: toStr(
            row.usuario
          ),

          OTE: toStr(
            row.OTE ??
              row.ote
          ),
        };
      });

    /* =======================================================
       3. AGRUPAR POR OTE
       ======================================================= */

    const oteMap = new Map<
      string,
      {
        OTE: string;
        cantidadItems: number;
        totalSolicitadoUnd: number;
        totalProcesadoUnd: number;
        totalPendienteUnd: number;
        itemsCompletos: number;
        itemsParciales: number;
        itemsPendientes: number;
        items: typeof generadas;
      }
    >();

    for (const item of generadas) {
      const actual =
        oteMap.get(item.OTE);

      if (!actual) {
        oteMap.set(
          item.OTE,
          {
            OTE: item.OTE,

            cantidadItems: 1,

            totalSolicitadoUnd:
              item.cantidadSolicitadaUnd,

            totalProcesadoUnd:
              item.cantidadProcesadaUnd,

            totalPendienteUnd:
              item.cantidadPendienteUnd,

            itemsCompletos:
              item.estadoProceso ===
              "Completo"
                ? 1
                : 0,

            itemsParciales:
              item.estadoProceso ===
              "Parcial"
                ? 1
                : 0,

            itemsPendientes:
              item.estadoProceso ===
              "Pendiente"
                ? 1
                : 0,

            items: [item],
          }
        );

        continue;
      }

      actual.items.push(item);

      actual.cantidadItems =
        actual.items.length;

      actual.totalSolicitadoUnd +=
        item.cantidadSolicitadaUnd;

      actual.totalProcesadoUnd +=
        item.cantidadProcesadaUnd;

      actual.totalPendienteUnd +=
        item.cantidadPendienteUnd;

      if (
        item.estadoProceso ===
        "Completo"
      ) {
        actual.itemsCompletos++;
      }

      if (
        item.estadoProceso ===
        "Parcial"
      ) {
        actual.itemsParciales++;
      }

      if (
        item.estadoProceso ===
        "Pendiente"
      ) {
        actual.itemsPendientes++;
      }
    }

    /* =======================================================
       4. ORDENAR
       ======================================================= */

    const ordenes = Array.from(
      oteMap.values()
    ).sort((a, b) =>
      b.OTE.localeCompare(
        a.OTE,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      )
    );

    /* =======================================================
       5. RESUMEN GENERAL
       ======================================================= */

    const totalSolicitadoUnd =
      generadas.reduce(
        (total, item) =>
          total +
          item.cantidadSolicitadaUnd,
        0
      );

    const totalProcesadoUnd =
      generadas.reduce(
        (total, item) =>
          total +
          item.cantidadProcesadaUnd,
        0
      );

    const totalPendienteUnd =
      generadas.reduce(
        (total, item) =>
          total +
          item.cantidadPendienteUnd,
        0
      );

    const totalItemsCompletos =
      generadas.filter(
        (item) =>
          item.estadoProceso ===
          "Completo"
      ).length;

    const totalItemsParciales =
      generadas.filter(
        (item) =>
          item.estadoProceso ===
          "Parcial"
      ).length;

    const totalItemsPendientes =
      generadas.filter(
        (item) =>
          item.estadoProceso ===
          "Pendiente"
      ).length;

    return NextResponse.json(
      {
        ok: true,

        totalOTE:
          ordenes.length,

        totalItems:
          generadas.length,

        totalSolicitadoUnd,

        totalProcesadoUnd,

        totalPendienteUnd,

        totalItemsCompletos,

        totalItemsParciales,

        totalItemsPendientes,

        ordenes,
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
      "[GET control producto proceso - ordenes corte]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "No fue posible consultar las órdenes de corte disponibles.",
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
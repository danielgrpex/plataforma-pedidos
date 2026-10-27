import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeHeader(value: any) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function rowsWithIndex(values: any[][]) {
  if (!values?.length) {
    return {
      headers: [],
      rows: [] as any[],
    };
  }

  const headers = (values[0] ?? []).map((h) =>
    String(h ?? "").trim()
  );

  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = {
      rowIndex: i + 2,
    };

    headers.forEach((h, idx) => {
      const v = row?.[idx] ?? "";

      obj[h] = v;
      obj[h.toLowerCase()] = v;
      obj[normalizeHeader(h)] = v;
    });

    return obj;
  });

  return {
    headers,
    rows,
  };
}

function getValue(
  row: Record<string, any>,
  ...keys: string[]
) {
  for (const key of keys) {
    const normalized =
      normalizeHeader(key);

    const value =
      row?.[key] ??
      row?.[key.toLowerCase()] ??
      row?.[normalized];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function toNumber(x: any) {
  const n = Number(
    String(x ?? "")
      .trim()
      .replace(",", ".")
  );

  return Number.isFinite(n)
    ? n
    : 0;
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET() {
  try {
    const [
      pVals,
      cVals,
      hVals,
      pedidosVals,
    ] = await Promise.all([
      getBasePrincipalRange(
        "SolicitudesProduccion!A:ZZ"
      ),

      getBasePrincipalRange(
        "SolicitudesCorte!A:ZZ"
      ),

      getBasePrincipalRange(
        "HistorialEntregasAlmacen!A:ZZ"
      ),

      /*
       * IMPORTANTE:
       * rowIndexPedido apunta a una fila física
       * de esta hoja.
       *
       * De aquí sacamos el consecutivo REAL.
       */
      getBasePrincipalRange(
        "Pedidos!A:ZZ"
      ),
    ]);

    /* =======================================================
       PEDIDOS
       ======================================================= */

    const pedidos =
      rowsWithIndex(
        pedidosVals
      ).rows;

    const pedidoPorFila =
      new Map<
        number,
        Record<string, any>
      >();

    for (
      const pedido of
        pedidos
    ) {
      pedidoPorFila.set(
        Number(
          pedido.rowIndex
        ),
        pedido
      );
    }

    function obtenerConsecutivo(
      rowIndexPedido: any,
      pedidoKey: any
    ) {
      const fila =
        Number(
          rowIndexPedido
        );

      if (
        !Number.isFinite(fila) ||
        fila < 2
      ) {
        return "";
      }

      const pedido =
        pedidoPorFila.get(
          fila
        );

      if (!pedido) {
        return "";
      }

      /*
       * Seguridad adicional:
       * si existe pedidoKey en ambas hojas,
       * verificamos que efectivamente sea
       * el mismo pedido.
       */
      const keyPedido =
        String(
          getValue(
            pedido,
            "pedidoKey"
          ) || ""
        ).trim();

      const keySolicitud =
        String(
          pedidoKey || ""
        ).trim();

      if (
        keyPedido &&
        keySolicitud &&
        keyPedido !== keySolicitud
      ) {
        console.warn(
          "[empacados] pedidoKey no coincide",
          {
            fila,
            keySolicitud,
            keyPedido,
          }
        );
      }

      return String(
        getValue(
          pedido,
          "Consecutivo",
          "Consec",
          "Consecutivo Pedido"
        ) || ""
      ).trim();
    }

    /* =======================================================
       HISTORIAL
       ======================================================= */

    const hist =
      rowsWithIndex(
        hVals
      ).rows;

    const entregadoMap =
      new Map<
        string,
        number
      >();

    for (
      const r of hist
    ) {
      const tipoNorm =
        norm(
          getValue(
            r,
            "tipo"
          )
        );

      const rowIndexItem =
        String(
          getValue(
            r,
            "rowIndexItem"
          ) ?? ""
        ).trim();

      const qty =
        toNumber(
          getValue(
            r,
            "cantidadEntregadaUnd"
          )
        );

      if (
        !tipoNorm ||
        !rowIndexItem
      ) {
        continue;
      }

      const key =
        `${tipoNorm}#${rowIndexItem}`;

      entregadoMap.set(
        key,
        (
          entregadoMap.get(
            key
          ) ?? 0
        ) + qty
      );
    }

    /* =======================================================
       PRODUCCIÓN
       ======================================================= */

    const prod =
      rowsWithIndex(
        pVals
      ).rows
        .filter(
          (r) =>
            String(
              getValue(
                r,
                "estado"
              ) ?? ""
            ).trim() ===
            "Empacado"
        )
        .map((r) => {
          const rowIndexItem =
            r.rowIndex;

          const rowIndexPedido =
            getValue(
              r,
              "rowIndexPedido"
            );

          const pedidoKey =
            String(
              getValue(
                r,
                "pedidoKey"
              ) ?? ""
            );

          const total =
            toNumber(
              getValue(
                r,
                "cantidadUND"
              )
            );

          const key =
            `produccion#${rowIndexItem}`;

          const entregado =
            entregadoMap.get(
              key
            ) ?? 0;

          const pendiente =
            Math.max(
              0,
              total -
                entregado
            );

          const consecutivo =
            obtenerConsecutivo(
              rowIndexPedido,
              pedidoKey
            );

          return {
            source:
              "produccion" as const,

            rowIndexItem,

            /*
             * Llave técnica.
             * NO es el consecutivo.
             */
            rowIndexPedido,

            /*
             * Consecutivo comercial real.
             */
            consecutivo,

            code:
              String(
                getValue(
                  r,
                  "OPE"
                ) ?? ""
              ),

            pedidoKey,

            producto:
              String(
                getValue(
                  r,
                  "productoKey"
                ) ?? ""
              ),

            cantidadTotalUnd:
              total,

            entregadoUnd:
              entregado,

            pendienteUnd:
              pendiente,
          };
        })
        .filter(
          (x) =>
            x.pendienteUnd >
            0
        );

    /* =======================================================
       CORTE
       ======================================================= */

    const corte =
      rowsWithIndex(
        cVals
      ).rows
        .filter(
          (r) =>
            String(
              getValue(
                r,
                "estadoitem",
                "estadoItem"
              ) ?? ""
            ).trim() ===
            "Empacado"
        )
        .map((r) => {
          const rowIndexItem =
            r.rowIndex;

          const rowIndexPedido =
            getValue(
              r,
              "rowIndexPedido"
            );

          const pedidoKey =
            String(
              getValue(
                r,
                "pedidoKey"
              ) ?? ""
            );

          const total =
            toNumber(
              getValue(
                r,
                "cantidadSolicitadaUnd"
              )
            );

          const key =
            `corte#${rowIndexItem}`;

          const entregado =
            entregadoMap.get(
              key
            ) ?? 0;

          const pendiente =
            Math.max(
              0,
              total -
                entregado
            );

          const consecutivo =
            obtenerConsecutivo(
              rowIndexPedido,
              pedidoKey
            );

          return {
            source:
              "corte" as const,

            rowIndexItem,

            /*
             * Llave técnica.
             */
            rowIndexPedido,

            /*
             * Consecutivo comercial real.
             */
            consecutivo,

            code:
              String(
                getValue(
                  r,
                  "OTE"
                ) ?? ""
              ),

            pedidoKey,

            producto:
              String(
                getValue(
                  r,
                  "productoSolicitado"
                ) ?? ""
              ),

            cantidadTotalUnd:
              total,

            entregadoUnd:
              entregado,

            pendienteUnd:
              pendiente,
          };
        })
        .filter(
          (x) =>
            x.pendienteUnd >
            0
        );

    return NextResponse.json(
      [
        ...prod,
        ...corte,
      ],
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, s-maxage=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    console.error(
      "[GET empacados con saldo]",
      e
    );

    return NextResponse.json(
      {
        error:
          "Error leyendo empacados/historial",
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
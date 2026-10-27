// app/api/produccion/entregas-almacen/entregar/route.ts

import { NextResponse } from "next/server";
import {
  getSheetsClient,
  getBasePrincipalRange,
} from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS GENERALES
   ========================================================= */

function headersFrom(values: any[][]): string[] {
  return (values?.[0] ?? []).map((h) =>
    String(h ?? "").trim()
  );
}

function colToLetter(n: number) {
  let s = "";

  while (n > 0) {
    const mod = (n - 1) % 26;

    s =
      String.fromCharCode(
        65 + mod
      ) + s;

    n = Math.floor(
      (n - 1) / 26
    );
  }

  return s;
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
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function normHeader(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function getByHeader(
  headers: string[],
  row: any[],
  ...possibleNames: string[]
) {
  const normalizedHeaders =
    headers.map(normHeader);

  for (
    const name of
      possibleNames
  ) {
    const idx =
      normalizedHeaders.indexOf(
        normHeader(name)
      );

    if (idx >= 0) {
      return row[idx] ?? "";
    }
  }

  return "";
}

/* =========================================================
   FECHAS
   ========================================================= */

function formatBogotaDate_dd_mmm_yyyy() {
  const d = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Bogota",

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",
      }
    ).formatToParts(d);

  const day =
    parts.find(
      (p) =>
        p.type === "day"
    )?.value ?? "01";

  const month =
    parts.find(
      (p) =>
        p.type === "month"
    )?.value ?? "Jan";

  const year =
    parts.find(
      (p) =>
        p.type === "year"
    )?.value ?? "2000";

  return `${day}-${month}-${year}`;
}

function nowBogotaTimestamp() {
  const d = new Date();

  return d.toLocaleString(
    "es-CO",
    {
      timeZone:
        "America/Bogota",
    }
  );
}

/* =========================================================
   IDS
   ========================================================= */

function makeId(
  prefix: string
) {
  const rnd =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

  return `${prefix}_${Date.now()}_${rnd}`;
}

/* =========================================================
   GOOGLE SHEETS
   ========================================================= */

async function readHeaders(
  sheet: string
) {
  const headerValues =
    await getBasePrincipalRange(
      `${sheet}!1:1`
    );

  return headersFrom(
    headerValues
  );
}

async function readRow(
  sheet: string,
  rowIndex: number
) {
  const values =
    await getBasePrincipalRange(
      `${sheet}!A${rowIndex}:ZZ${rowIndex}`
    );

  return values?.[0] ?? [];
}

async function updateCell(
  sheet: string,
  rowIndex: number,
  colIndex1Based: number,
  value: any
) {
  const sheets =
    await getSheetsClient();

  const col =
    colToLetter(
      colIndex1Based
    );

  await sheets.spreadsheets.values.update({
    spreadsheetId:
      env.SHEET_BASE_PRINCIPAL_ID,

    range:
      `${sheet}!${col}${rowIndex}`,

    valueInputOption:
      "USER_ENTERED",

    requestBody: {
      values: [
        [value],
      ],
    },
  });
}

async function appendRowByHeaders(
  sheet: string,
  data: Record<
    string,
    any
  >
) {
  const sheets =
    await getSheetsClient();

  const headers =
    await readHeaders(
      sheet
    );

  if (!headers.length) {
    throw new Error(
      `No headers for ${sheet}`
    );
  }

  const row =
    new Array(
      headers.length
    ).fill("");

  /*
   * Mapa normalizado para no depender de:
   * - mayúsculas
   * - minúsculas
   * - espacios
   * - guiones bajos
   * - tildes
   */
  const map =
    new Map<
      string,
      number
    >();

  headers.forEach(
    (header, index) => {
      const key =
        normHeader(
          header
        );

      if (key) {
        map.set(
          key,
          index
        );
      }
    }
  );

  for (
    const [k, v] of
      Object.entries(data)
  ) {
    const idx =
      map.get(
        normHeader(k)
      );

    if (
      idx === undefined
    ) {
      continue;
    }

    row[idx] =
      v ?? "";
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId:
      env.SHEET_BASE_PRINCIPAL_ID,

    range:
      `${sheet}!A:ZZ`,

    valueInputOption:
      "USER_ENTERED",

    insertDataOption:
      "INSERT_ROWS",

    requestBody: {
      values: [
        row,
      ],
    },
  });
}

function rowsWithIndex(
  values: any[][]
) {
  if (!values?.length) {
    return {
      headers: [],
      rows:
        [] as any[],
    };
  }

  const headers =
    (values[0] ?? []).map(
      (h) =>
        String(
          h ?? ""
        ).trim()
    );

  const rows =
    values
      .slice(1)
      .map(
        (row, i) => {
          const obj:
            Record<
              string,
              any
            > = {
            rowIndex:
              i + 2,
          };

          headers.forEach(
            (
              h,
              idx
            ) => {
              const value =
                row?.[idx] ??
                "";

              obj[h] =
                value;

              obj[
                h.toLowerCase()
              ] = value;

              obj[
                normHeader(h)
              ] = value;
            }
          );

          return obj;
        }
      );

  return {
    headers,
    rows,
  };
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const {
      source,
      rowIndexItem,
      cantidadEntregarUnd,
      usuario,
    } = body ?? {};

    /* =======================================================
       VALIDACIONES BÁSICAS
       ======================================================= */

    if (
      !source ||
      !rowIndexItem ||
      !cantidadEntregarUnd
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan datos: source, rowIndexItem, cantidadEntregarUnd",
        },
        {
          status: 400,
        }
      );
    }

    if (
      ![
        "produccion",
        "corte",
      ].includes(
        String(source)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "source inválido",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      String(
        usuario ?? ""
      ).trim();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Selecciona el usuario que entrega",
        },
        {
          status: 400,
        }
      );
    }

    const qty =
      toNumber(
        cantidadEntregarUnd
      );

    if (qty <= 0) {
      return NextResponse.json(
        {
          error:
            "cantidadEntregarUnd inválida",
        },
        {
          status: 400,
        }
      );
    }

    const fechaEntrega =
      formatBogotaDate_dd_mmm_yyyy();

    const fechaMovimiento =
      nowBogotaTimestamp();

    /* =======================================================
       1) LEER ITEM
       ======================================================= */

    const sheet =
      source ===
      "produccion"
        ? "SolicitudesProduccion"
        : "SolicitudesCorte";

    const headers =
      await readHeaders(
        sheet
      );

    const row =
      await readRow(
        sheet,
        Number(
          rowIndexItem
        )
      );

    if (
      !headers.length ||
      !row.length
    ) {
      return NextResponse.json(
        {
          error:
            "No se pudo leer fila item",
        },
        {
          status: 500,
        }
      );
    }

    const get = (
      name: string
    ) =>
      getByHeader(
        headers,
        row,
        name
      );

    const pedidoKey =
      String(
        get(
          "pedidoKey"
        ) ?? ""
      ).trim();

    /*
     * IMPORTANTE:
     *
     * rowIndexPedido NO es el consecutivo.
     *
     * Es la fila física del producto dentro
     * de la hoja Pedidos.
     */
    const rowIndexPedido =
      Number(
        get(
          "rowIndexPedido"
        ) ?? ""
      );

    const code =
      source ===
      "produccion"
        ? String(
            get(
              "OPE"
            ) ?? ""
          ).trim()
        : String(
            get(
              "OTE"
            ) ?? ""
          ).trim();

    const producto =
      source ===
      "produccion"
        ? String(
            get(
              "productoKey"
            ) ?? ""
          ).trim()
        : String(
            get(
              "productoSolicitado"
            ) ?? ""
          ).trim();

    const total =
      source ===
      "produccion"
        ? toNumber(
            get(
              "cantidadUND"
            )
          )
        : toNumber(
            get(
              "cantidadSolicitadaUnd"
            )
          );

    const inventarioId =
      String(
        get(
          "inventarioId"
        ) ?? ""
      ).trim() ||
      String(
        get(
          "inventarioOrigenId"
        ) ?? ""
      ).trim() ||
      "";

    if (
      !pedidoKey ||
      !rowIndexPedido ||
      !code ||
      total <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Item sin datos clave (pedidoKey/rowIndexPedido/OPE-OTE/total)",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       1.1) LEER PEDIDO ORIGINAL Y CONSECUTIVO REAL
       ======================================================= */

    const pedidosHeaders =
      await readHeaders(
        "Pedidos"
      );

    const pedidoRow =
      await readRow(
        "Pedidos",
        rowIndexPedido
      );

    if (!pedidoRow.length) {
      return NextResponse.json(
        {
          error:
            `No se encontró la fila ${rowIndexPedido} en Pedidos.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validación de seguridad:
     * comprobamos que la fila de Pedidos corresponda
     * realmente al mismo pedidoKey.
     */
    const pedidoKeyOriginal =
      String(
        getByHeader(
          pedidosHeaders,
          pedidoRow,
          "pedidoKey"
        ) ?? ""
      ).trim();

    if (
      pedidoKeyOriginal &&
      pedidoKey &&
      pedidoKeyOriginal !==
        pedidoKey
    ) {
      console.warn(
        "[POST entregar] pedidoKey de Solicitud no coincide con Pedidos",
        {
          source,
          rowIndexItem,
          rowIndexPedido,
          pedidoKeySolicitud:
            pedidoKey,
          pedidoKeyPedidos:
            pedidoKeyOriginal,
        }
      );

      return NextResponse.json(
        {
          error:
            "La fila de Pedidos no corresponde al pedido de esta solicitud. No se realizó la entrega.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Este SÍ es el consecutivo comercial
     * que debe mostrarse al usuario.
     */
    const consecutivo =
      String(
        getByHeader(
          pedidosHeaders,
          pedidoRow,
          "Consecutivo",
          "Consec",
          "Consecutivo Pedido"
        ) ?? ""
      ).trim();

    if (!consecutivo) {
      console.warn(
        "[POST entregar] No se encontró consecutivo comercial",
        {
          source,
          rowIndexItem,
          rowIndexPedido,
          pedidoKey,
        }
      );
    }

    /* =======================================================
       2) CALCULAR ENTREGADO ACUMULADO
       ======================================================= */

    const hVals =
      await getBasePrincipalRange(
        "HistorialEntregasAlmacen!A:Z"
      );

    const hist =
      rowsWithIndex(
        hVals
      ).rows;

    let entregado =
      0;

    for (
      const r of hist
    ) {
      const tipoNorm =
        norm(
          r.tipo ??
            r[
              normHeader(
                "tipo"
              )
            ]
        );

      const idx =
        Number(
          r.rowIndexItem ??
            r.rowindexitem ??
            r[
              normHeader(
                "rowIndexItem"
              )
            ] ??
            0
        );

      const cantidadHistorial =
        toNumber(
          r.cantidadEntregadaUnd ??
            r.cantidadentregadaund ??
            r[
              normHeader(
                "cantidadEntregadaUnd"
              )
            ]
        );

      if (
        tipoNorm ===
          source &&
        idx ===
          Number(
            rowIndexItem
          )
      ) {
        entregado +=
          cantidadHistorial;
      }
    }

    const pendiente =
      Math.max(
        0,
        total -
          entregado
      );

    if (
      qty >
      pendiente
    ) {
      return NextResponse.json(
        {
          error:
            "La cantidad supera el pendiente",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       3) REGISTRAR HISTORIAL
       ======================================================= */

    await appendRowByHeaders(
      "HistorialEntregasAlmacen",
      {
        entregaId:
          makeId(
            "ENT"
          ),

        timestamp:
          fechaMovimiento,

        /*
         * Siempre sin tilde:
         * produccion | corte
         */
        tipo:
          source,

        referenciaOperacion:
          code,

        /*
         * Fila física dentro de
         * SolicitudesProduccion /
         * SolicitudesCorte.
         */
        rowIndexItem:
          Number(
            rowIndexItem
          ),

        /*
         * Fila física del producto
         * dentro de Pedidos.
         */
        rowIndexPedido,

        /*
         * Número comercial visible.
         */
        consecutivo,

        pedidoKey,

        producto,

        cantidadEntregadaUnd:
          qty,

        cantidadEntregadaM:
          "",

        almacenOrigen:
          source ===
          "produccion"
            ? "Producción"
            : "Corte",

        almacenDestino:
          "Almacén",

        usuario:
          user,

        observacion:
          "",
      }
    );

    /* =======================================================
       4) REGISTRAR MOVIMIENTO INVENTARIO
       ======================================================= */

    await appendRowByHeaders(
      "MovimientosInventario",
      {
        movimientoId:
          makeId(
            "MOV"
          ),

        inventarioId,

        tipoMovimiento:
          "ENTRADA",

        cantidadUnd:
          qty,

        cantidadM:
          "",

        almacenOrigen:
          source ===
          "produccion"
            ? "Producción"
            : "Corte",

        almacenDestino:
          "Almacén",

        pedidoKey,

        referenciaOperacion:
          code,

        motivo:
          "Entrega parcial a almacén",

        fechaMovimiento,

        usuario:
          user,
      }
    );

    /* =======================================================
       5) SI COMPLETÓ -> ACTUALIZAR ITEM
       ======================================================= */

    const nuevoPendiente =
      Math.max(
        0,
        pendiente -
          qty
      );

    if (
      nuevoPendiente <=
      0
    ) {
      const estadoColName =
        source ===
        "produccion"
          ? "estado"
          : "estadoitem";

      const normalizedHeaders =
        headers.map(
          normHeader
        );

      const idxEstado =
        normalizedHeaders.indexOf(
          normHeader(
            estadoColName
          )
        );

      if (
        idxEstado >= 0
      ) {
        await updateCell(
          sheet,

          Number(
            rowIndexItem
          ),

          idxEstado + 1,

          "Entregado Almacén"
        );
      }

      /* =====================================================
         6) ACTUALIZAR PEDIDOS
         ===================================================== */

      const normalizedPedidosHeaders =
        pedidosHeaders.map(
          normHeader
        );

      const idxEstadoPedido =
        normalizedPedidosHeaders.indexOf(
          normHeader(
            "Estado"
          )
        );

      const idxFechaReal =
        normalizedPedidosHeaders.indexOf(
          normHeader(
            "Fecha Real Entrega Almacén"
          )
        );

      /*
       * AQUÍ rowIndexPedido DEBE seguir siendo
       * la fila física de Pedidos.
       *
       * NO usar consecutivo.
       */
      if (
        idxEstadoPedido >=
        0
      ) {
        await updateCell(
          "Pedidos",

          rowIndexPedido,

          idxEstadoPedido +
            1,

          "Almacén"
        );
      }

      if (
        idxFechaReal >= 0
      ) {
        await updateCell(
          "Pedidos",

          rowIndexPedido,

          idxFechaReal +
            1,

          fechaEntrega
        );
      }
    }

    /* =======================================================
       RESPUESTA
       ======================================================= */

    return NextResponse.json(
      {
        ok: true,

        source,

        rowIndexItem:
          Number(
            rowIndexItem
          ),

        /*
         * Fila técnica en Pedidos.
         */
        rowIndexPedido,

        /*
         * Consecutivo comercial.
         */
        consecutivo,

        pedidoKey,

        referenciaOperacion:
          code,

        cantidadEntregadaUnd:
          qty,

        pendienteAnterior:
          pendiente,

        pendiente:
          nuevoPendiente,

        estado:
          nuevoPendiente <=
          0
            ? "Entregado Almacén"
            : "Empacado",
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (e) {
    console.error(
      "[POST entregar parcial]",
      e
    );

    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Error interno",
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
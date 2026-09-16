import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
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
  const n = Math.floor(toNumber(value));

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
    const position = index.get(
      normKey(key)
    );

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
   PRODUCTOS
   ========================================================= */

function parseLengthToMm(text: string) {
  const match = toStr(text).match(
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i
  );

  if (!match) return 0;

  const number = Number(
    match[1].replace(",", ".")
  );

  if (!Number.isFinite(number)) {
    return 0;
  }

  const unit =
    match[2].toLowerCase();

  if (unit === "mm") {
    return Math.round(number);
  }

  if (unit === "cm") {
    return Math.round(number * 10);
  }

  if (unit === "m") {
    return Math.round(number * 1000);
  }

  return 0;
}

function parseProducto(producto: string) {
  const raw = toStr(producto);

  const partes = raw
    .split("|")
    .map((parte) => parte.trim());

  const familia =
    partes[0] || "";

  const color =
    partes[1] || "";

  const ancho =
    partes[2] || "";

  let largoTexto =
    partes[3] || "";

  if (!parseLengthToMm(largoTexto)) {
    const posible = partes.find(
      (parte) =>
        /^\d+(?:[.,]\d+)?\s*(mm|cm|m)$/i.test(
          parte.trim()
        )
    );

    if (posible) {
      largoTexto = posible;
    }
  }

  const medidaMm =
    parseLengthToMm(largoTexto);

  const acabado =
    partes.length >= 5
      ? partes.slice(4).join(" | ")
      : "";

  return {
    raw,
    familia,
    color,
    ancho,
    medidaMm,
    acabado,
  };
}

function formatMedidaProducto(
  medidaMm: number
) {
  const metros =
    medidaMm / 1000;

  let text =
    metros.toFixed(3);

  text = text.replace(
    /0+$/,
    ""
  );

  text = text.replace(
    /\.$/,
    ""
  );

  text = text.replace(
    ".",
    ","
  );

  return `${text} m`;
}

function productoConNuevaMedida(
  productoOriginal: string,
  medidaMm: number
) {
  const partes = toStr(
    productoOriginal
  )
    .split("|")
    .map((parte) => parte.trim());

  if (partes.length >= 4) {
    partes[3] =
      formatMedidaProducto(
        medidaMm
      );

    return partes.join(" | ");
  }

  return `${productoOriginal} | ${formatMedidaProducto(
    medidaMm
  )}`;
}

/* =========================================================
   INVENTARIO KEY
   Debe usar exactamente la misma lógica que
   Entrada de Producción.
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

type RemanenteBody = {
  cantidad: number;
  medidaMm: number;
};

type Body = {
  transformacionKey?: string;

  solicitudCorteId: string;
  inventarioOrigenKey: string;

  cantidadOrigenUnd: number;
  cantidadObtenidaUnd: number;

  remanentes?: RemanenteBody[];

  usuario?: string;
  supervisor: string;
  turno: string;
  observacion?: string;
};

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: Request
) {
  try {
    const body =
      (await req.json()) as Body;

    const solicitudCorteId =
      toStr(
        body.solicitudCorteId
      );

    const inventarioOrigenKey =
      toStr(
        body.inventarioOrigenKey
      );

    const cantidadOrigenUnd =
      toInt(
        body.cantidadOrigenUnd
      );

    const cantidadObtenidaUnd =
      toInt(
        body.cantidadObtenidaUnd
      );

    const usuario =
      toStr(body.usuario) ||
      "produccion";

    const supervisor =
      toStr(body.supervisor);

    const turno =
      toStr(body.turno);

    const observacion =
      toStr(body.observacion);

    const transformacionKey =
      toStr(
        body.transformacionKey
      ) ||
      makeId("TRFPP");

    const remanentesBody =
      Array.isArray(
        body.remanentes
      )
        ? body.remanentes
        : [];

    /* =======================================================
       VALIDACIONES BÁSICAS
       ======================================================= */

    if (!solicitudCorteId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Solicitud de corte requerida.",
        },
        { status: 400 }
      );
    }

    if (!inventarioOrigenKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Inventario de origen requerido.",
        },
        { status: 400 }
      );
    }

    if (
      cantidadOrigenUnd <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La cantidad tomada debe ser mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (
      cantidadObtenidaUnd <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La cantidad obtenida debe ser mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (!turno) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Turno requerido.",
        },
        { status: 400 }
      );
    }

    if (!supervisor) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supervisor requerido.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       VALIDAR REMANENTES
       ======================================================= */

    const remanentes: Array<{
      cantidad: number;
      medidaMm: number;
    }> = [];

    for (
      let i = 0;
      i < remanentesBody.length;
      i++
    ) {
      const cantidad =
        toInt(
          remanentesBody[i]
            .cantidad
        );

      const medidaMm =
        toInt(
          remanentesBody[i]
            .medidaMm
        );

      if (
        cantidad <= 0 ||
        medidaMm <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Remanente ${
                i + 1
              } inválido.`,
          },
          { status: 400 }
        );
      }

      remanentes.push({
        cantidad,
        medidaMm,
      });
    }

    /* =======================================================
       VALIDAR SUPERVISOR CONTRA INFORMACIÓN
       ======================================================= */

    const supervisoresValues =
      await getInfoSheetRange(
        "Supervisores!A:A"
      );

    const supervisores =
      supervisoresValues
        .slice(1)
        .map((row) =>
          toStr(row?.[0])
        )
        .filter(Boolean);

    const supervisorValido =
      supervisores.find(
        (nombre) =>
          norm(nombre) ===
          norm(supervisor)
      );

    if (!supervisorValido) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El supervisor seleccionado no existe en el catálogo.",
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
       LEER DATOS NECESARIOS
       ======================================================= */

    const [
      corteResp,
      inventarioResp,
      movimientosResp,
      transformacionesResp,
    ] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          "SolicitudesCorte!A:P",
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
          "TransformacionesProceso!A:O",
        valueRenderOption:
          "UNFORMATTED_VALUE",
      }),
    ]);

    const corteValues =
      (corteResp.data.values ||
        []) as any[][];

    const inventarioValues =
      (inventarioResp.data.values ||
        []) as any[][];

    const movimientosValues =
      (movimientosResp.data.values ||
        []) as any[][];

    const transformacionesValues =
      (transformacionesResp.data.values ||
        []) as any[][];

    if (
      corteValues.length < 2
    ) {
      throw new Error(
        "No hay información en SolicitudesCorte."
      );
    }

    if (
      inventarioValues.length <
      2
    ) {
      throw new Error(
        "No hay inventario de producto en proceso."
      );
    }

    /* =======================================================
       HEADERS
       ======================================================= */

    const corteHeader =
      corteValues[0] || [];

    const corteRows =
      corteValues.slice(1);

    const corteIdx =
      buildHeaderIndex(
        corteHeader
      );

    const inventarioHeader =
      inventarioValues[0] || [];

    const inventarioRows =
      inventarioValues.slice(1);

    const inventarioIdx =
      buildHeaderIndex(
        inventarioHeader
      );

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

    const transformacionesHeader =
      transformacionesValues[0] || [];

    const transformacionesRows =
      transformacionesValues.length > 1
        ? transformacionesValues.slice(1)
        : [];

    const transformacionesIdx =
      buildHeaderIndex(
        transformacionesHeader
      );

    /* =======================================================
       BUSCAR SOLICITUD DE CORTE
       ======================================================= */

    const corteRowIndex =
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
      corteRowIndex < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La solicitud de corte no existe.",
        },
        { status: 404 }
      );
    }

    const corteRow =
      corteRows[
        corteRowIndex
      ];

    /*
     * Número real de fila en Google Sheets:
     *
     * fila 1 = encabezados
     * corteRows[0] = fila 2
     */
    const corteSheetRow =
      corteRowIndex + 2;

    const estadoCorte =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "estadoitem"
        )
      );

    /*
     * Necesitamos saber en qué columna está estadoitem
     * para poder actualizarla dinámicamente.
     *
     * Así no amarramos el código a una letra específica.
     */
    const colEstadoItem =
      corteIdx.get(
        normKey("estadoitem")
      );

    if (
      colEstadoItem ===
      undefined
    ) {
      throw new Error(
        "No se encontró la columna estadoitem en SolicitudesCorte."
      );
    }

    /*
     * Solo permitimos transformación sobre ítems
     * que todavía estén Generada.
     *
     * Cuando PEX los cierre en Empacado ya no podrán
     * seguir consumiendo producto en proceso.
     */
    if (
      norm(estadoCorte) !==
      "generada"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `La solicitud de corte ya no está en estado Generada. Estado actual: ${
              estadoCorte ||
              "sin estado"
            }.`,
        },
        { status: 400 }
      );
    }

    const OTE =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "OTE"
        )
      );

    const consecutivoCorte =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "rowIndexPedido"
        )
      );

    const productoSolicitado =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "productoSolicitado"
        )
      );

    const cantidadSolicitada =
      toInt(
        pickCell(
          corteRow,
          corteIdx,
          "cantidadSolicitadaUnd"
        )
      );

    const productoObjetivo =
      parseProducto(
        productoSolicitado
      );

    if (
      !productoObjetivo.familia ||
      !productoObjetivo.color ||
      !productoObjetivo.ancho ||
      !productoObjetivo.medidaMm
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No fue posible interpretar el producto solicitado.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       EVITAR SOBREPASAR LO PEDIDO

       Sumamos transformaciones anteriores activas
       para este solicitudCorteId.
       ======================================================= */

    let obtenidoAnterior = 0;

    for (
      const row of
        transformacionesRows
    ) {
      const idSolicitud =
        toStr(
          pickCell(
            row,
            transformacionesIdx,
            "solicitudCorteId"
          )
        );

      const estado =
        norm(
          pickCell(
            row,
            transformacionesIdx,
            "estado"
          )
        );

      const key =
        toStr(
          pickCell(
            row,
            transformacionesIdx,
            "transformacionKey"
          )
        );

      /*
       * Excluimos la misma transformacionKey.
       *
       * Esto permite que, ante un reintento,
       * no contemos dos veces la misma operación
       * para calcular el pendiente previo.
       */
      if (
        idSolicitud ===
          solicitudCorteId &&
        estado !== "anulado" &&
        key !== transformacionKey
      ) {
        obtenidoAnterior +=
          toInt(
            pickCell(
              row,
              transformacionesIdx,
              "cantidadObtenidaUnd"
            )
          );
      }
    }

    const pendienteAntes =
      Math.max(
        0,
        cantidadSolicitada -
          obtenidoAnterior
      );

    if (
      cantidadObtenidaUnd >
      pendienteAntes
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Solo quedan ${pendienteAntes} und pendientes para este consecutivo.`,
        },
        { status: 400 }
      );
    }

    /*
     * Pendiente que quedaría después de aplicar
     * ESTA transformación.
     */
    const pendienteDespues =
      Math.max(
        0,
        pendienteAntes -
          cantidadObtenidaUnd
      );

    /* =======================================================
       BUSCAR INVENTARIO ORIGEN
       ======================================================= */

    const inventarioOrigenIndex =
      inventarioRows.findIndex(
        (row) =>
          toStr(
            pickCell(
              row,
              inventarioIdx,
              "inventarioKey"
            )
          ) ===
          inventarioOrigenKey
      );

    if (
      inventarioOrigenIndex <
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El inventario de origen ya no existe.",
        },
        { status: 404 }
      );
    }

    const inventarioOrigenRow =
      inventarioRows[
        inventarioOrigenIndex
      ];

    const OPEOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "OPE"
        )
      );

    const productoOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "producto"
        )
      );

    const referenciaOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "referencia"
        )
      );

    const colorOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "color"
        )
      );

    const anchoOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "ancho"
        )
      );

    const acabadoOrigen =
      toStr(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "acabado"
        )
      );

    const medidaOrigenMm =
      toInt(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "medida_mm"
        )
      );

    const cantidadDisponibleHoja =
      toNumber(
        pickCell(
          inventarioOrigenRow,
          inventarioIdx,
          "cantidadDisponible"
        )
      );

    if (
      cantidadOrigenUnd >
      cantidadDisponibleHoja
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `El lote solo tiene ${cantidadDisponibleHoja} und disponibles.`,
        },
        { status: 400 }
      );
    }

    /* =======================================================
       VALIDAR COMPATIBILIDAD
       ======================================================= */

    const productoOrigenParsed =
      parseProducto(
        productoOrigen
      );

    const compatible =
      norm(
        productoOrigenParsed.familia
      ) ===
        norm(
          productoObjetivo.familia
        ) &&
      norm(
        productoOrigenParsed.color
      ) ===
        norm(
          productoObjetivo.color
        ) &&
      norm(
        productoOrigenParsed.ancho
      ) ===
        norm(
          productoObjetivo.ancho
        ) &&
      medidaOrigenMm >=
        productoObjetivo.medidaMm;

    if (!compatible) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El lote seleccionado ya no es compatible con el producto solicitado.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       VALIDAR REMANENTES CONTRA ORIGEN
       ======================================================= */

    for (
      let i = 0;
      i < remanentes.length;
      i++
    ) {
      if (
        remanentes[i]
          .medidaMm >
        medidaOrigenMm
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `El remanente ${
                i + 1
              } supera la longitud del material de origen.`,
          },
          { status: 400 }
        );
      }
    }

    /* =======================================================
       BALANCE DE LONGITUD
       ======================================================= */

    const metrosOrigen =
      (cantidadOrigenUnd *
        medidaOrigenMm) /
      1000;

    const metrosProductoBueno =
      (cantidadObtenidaUnd *
        productoObjetivo.medidaMm) /
      1000;

    const metrosRemanentes =
      remanentes.reduce(
        (total, remanente) =>
          total +
          (remanente.cantidad *
            remanente.medidaMm) /
            1000,
        0
      );

    const diferenciaMetros =
      metrosOrigen -
      metrosProductoBueno -
      metrosRemanentes;

    if (
      diferenciaMetros <
      -0.001
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El producto obtenido más los remanentes superan el material tomado.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       IDEMPOTENCIA
       ======================================================= */

    const transformacionExistente =
      transformacionesRows.find(
        (row) =>
          toStr(
            pickCell(
              row,
              transformacionesIdx,
              "transformacionKey"
            )
          ) ===
          transformacionKey
      );

    const relacionesExistentes =
      new Set<string>();

    for (
      const row of
        movimientosRows
    ) {
      const relacion =
        toStr(
          pickCell(
            row,
            movimientosIdx,
            "movimientoRelacionado"
          )
        );

      if (relacion) {
        relacionesExistentes.add(
          relacion
        );
      }
    }

    /* =======================================================
       SALDOS ACTUALES DESDE KARDEX
       ======================================================= */

    const saldoMovimiento =
      new Map<string, number>();

    for (
      const row of
        movimientosRows
    ) {
      const estado =
        norm(
          pickCell(
            row,
            movimientosIdx,
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
            row,
            movimientosIdx,
            "inventarioKey"
          )
        );

      if (!key) continue;

      const cantidad =
        toNumber(
          pickCell(
            row,
            movimientosIdx,
            "cantidadMovimiento"
          )
        );

      saldoMovimiento.set(
        key,
        (saldoMovimiento.get(
          key
        ) || 0) +
          cantidad
      );
    }

    /* =======================================================
       AGRUPAR REMANENTES POR MEDIDA
       ======================================================= */

    const remanentesAgrupados =
      new Map<number, number>();

    for (
      const remanente of
        remanentes
    ) {
      remanentesAgrupados.set(
        remanente.medidaMm,
        (remanentesAgrupados.get(
          remanente.medidaMm
        ) || 0) +
          remanente.cantidad
      );
    }

    /* =======================================================
       MOVIMIENTOS A CREAR
       ======================================================= */

    const movimientosNuevos:
      any[][] = [];

    const deltaNuevo =
      new Map<string, number>();

    function agregarDelta(
      key: string,
      cantidad: number
    ) {
      deltaNuevo.set(
        key,
        (deltaNuevo.get(key) ||
          0) + cantidad
      );
    }

    const relacionConsumo =
      `${transformacionKey}|CONSUMO`;

    if (
      !relacionesExistentes.has(
        relacionConsumo
      )
    ) {
      const observacionConsumo =
        [
          `Consumo empaque`,
          `Solicitud ${solicitudCorteId}`,
          `Producto final ${productoSolicitado}`,
          observacion,
        ]
          .filter(Boolean)
          .join(" · ");

      movimientosNuevos.push([
        makeId("MOVPP"), // A
        timestamp, // B
        "CONSUMO_EMPAQUE", // C
        OPEOrigen, // D
        OTE, // E
        consecutivoCorte, // F
        productoOrigen, // G
        referenciaOrigen, // H
        colorOrigen, // I
        anchoOrigen, // J
        acabadoOrigen, // K
        medidaOrigenMm, // L
        -cantidadOrigenUnd, // M
        inventarioOrigenKey, // N
        transformacionKey, // O
        usuario, // P
        turno, // Q
        observacionConsumo, // R
        relacionConsumo, // S
        "ACTIVO", // T
        supervisorValido, // U
      ]);

      agregarDelta(
        inventarioOrigenKey,
        -cantidadOrigenUnd
      );
    }

    /* =======================================================
       METADATOS INVENTARIOS AFECTADOS
       ======================================================= */

    type MetaInventario = {
      inventarioKey: string;
      OPE: string;
      producto: string;
      referencia: string;
      color: string;
      ancho: string;
      acabado: string;
      medidaMm: number;
    };

    const metaInventarios =
      new Map<
        string,
        MetaInventario
      >();

    metaInventarios.set(
      inventarioOrigenKey,
      {
        inventarioKey:
          inventarioOrigenKey,

        OPE:
          OPEOrigen,

        producto:
          productoOrigen,

        referencia:
          referenciaOrigen,

        color:
          colorOrigen,

        ancho:
          anchoOrigen,

        acabado:
          acabadoOrigen,

        medidaMm:
          medidaOrigenMm,
      }
    );

    /* =======================================================
       MOVIMIENTOS DE REMANENTES
       ======================================================= */

    for (
      const [
        medidaMm,
        cantidad,
      ] of remanentesAgrupados.entries()
    ) {
      const productoRemanente =
        productoConNuevaMedida(
          productoOrigen,
          medidaMm
        );

      const inventarioKey =
        makeInventarioKey(
          OPEOrigen,
          productoRemanente,
          medidaMm
        );

      metaInventarios.set(
        inventarioKey,
        {
          inventarioKey,

          OPE:
            OPEOrigen,

          producto:
            productoRemanente,

          referencia:
            referenciaOrigen,

          color:
            colorOrigen,

          ancho:
            anchoOrigen,

          acabado:
            acabadoOrigen,

          medidaMm,
        }
      );

      const relacionRemanente =
        `${transformacionKey}|REM|${inventarioKey}`;

      if (
        relacionesExistentes.has(
          relacionRemanente
        )
      ) {
        continue;
      }

      const observacionRemanente =
        [
          `Remanente de transformación`,

          `${cantidad} und × ${formatMedidaProducto(
            medidaMm
          )}`,

          `Origen ${OPEOrigen}`,

          `OTE ${OTE}`,

          `Consecutivo ${consecutivoCorte}`,
        ].join(" · ");

      movimientosNuevos.push([
        makeId("MOVPP"), // A
        timestamp, // B
        "ENTRADA_REMANENTE", // C
        OPEOrigen, // D
        OTE, // E
        consecutivoCorte, // F
        productoRemanente, // G
        referenciaOrigen, // H
        colorOrigen, // I
        anchoOrigen, // J
        acabadoOrigen, // K
        medidaMm, // L
        cantidad, // M
        inventarioKey, // N
        transformacionKey, // O
        usuario, // P
        turno, // Q
        observacionRemanente, // R
        relacionRemanente, // S
        "ACTIVO", // T
        supervisorValido, // U
      ]);

      agregarDelta(
        inventarioKey,
        cantidad
      );
    }

    /* =======================================================
       1. GUARDAR MOVIMIENTOS
       ======================================================= */

    if (
      movimientosNuevos.length
    ) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range:
          "MovimientosProceso!A:U",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values:
            movimientosNuevos,
        },
      });
    }

    /* =======================================================
       2. ACTUALIZAR INVENTARIO

       El saldo se calcula con:
       movimientos existentes + movimientos nuevos.
       ======================================================= */

    const inventarioActualMap =
      new Map<
        string,
        {
          sheetRow: number;
          row: any[];
        }
      >();

    inventarioRows.forEach(
      (row, index) => {
        const key =
          toStr(
            pickCell(
              row,
              inventarioIdx,
              "inventarioKey"
            )
          );

        if (!key) return;

        inventarioActualMap.set(
          key,
          {
            sheetRow:
              index + 2,

            row,
          }
        );
      }
    );

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

    const inventariosAppend:
      any[][] = [];

    const inventariosUpdate: Array<{
      range: string;
      values: any[][];
    }> = [];

    const saldosFinales: Array<{
      inventarioKey: string;
      OPE: string;
      producto: string;
      medida_mm: number;
      saldoDisponible: number;
    }> = [];

    for (
      const [
        key,
        meta,
      ] of metaInventarios.entries()
    ) {
      const saldoAnterior =
        saldoMovimiento.get(key) ||
        0;

      const delta =
        deltaNuevo.get(key) ||
        0;

      const saldoFinal =
        saldoAnterior + delta;

      const estado =
        saldoFinal > 0
          ? "Disponible"
          : saldoFinal === 0
            ? "Agotado"
            : "REVISAR";

      const existente =
        inventarioActualMap.get(
          key
        );

      if (existente) {
        inventariosUpdate.push(
          {
            range:
              `InventarioProceso!${toColLetter(
                colCantidad
              )}${existente.sheetRow}:${toColLetter(
                colCantidad
              )}${existente.sheetRow}`,

            values: [
              [saldoFinal],
            ],
          },

          {
            range:
              `InventarioProceso!${toColLetter(
                colFecha
              )}${existente.sheetRow}:${toColLetter(
                colFecha
              )}${existente.sheetRow}`,

            values: [
              [timestamp],
            ],
          },

          {
            range:
              `InventarioProceso!${toColLetter(
                colEstado
              )}${existente.sheetRow}:${toColLetter(
                colEstado
              )}${existente.sheetRow}`,

            values: [
              [estado],
            ],
          }
        );
      } else {
        inventariosAppend.push([
          key, // A
          meta.OPE, // B
          meta.producto, // C
          meta.referencia, // D
          meta.color, // E
          meta.ancho, // F
          meta.acabado, // G
          meta.medidaMm, // H
          saldoFinal, // I
          timestamp, // J
          estado, // K
        ]);
      }

      saldosFinales.push({
        inventarioKey:
          key,

        OPE:
          meta.OPE,

        producto:
          meta.producto,

        medida_mm:
          meta.medidaMm,

        saldoDisponible:
          saldoFinal,
      });
    }

    if (
      inventariosAppend.length
    ) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range:
          "InventarioProceso!A:K",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values:
            inventariosAppend,
        },
      });
    }

    if (
      inventariosUpdate.length
    ) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,

        requestBody: {
          valueInputOption:
            "USER_ENTERED",

          data:
            inventariosUpdate,
        },
      });
    }

    /* =======================================================
       3. CABECERA DE TRANSFORMACIÓN
       ======================================================= */

    if (!transformacionExistente) {
      const observacionTransformacion =
        [
          observacion,

          `Balance origen ${metrosOrigen.toFixed(
            3
          )} m`,

          `producto ${metrosProductoBueno.toFixed(
            3
          )} m`,

          `remanentes ${metrosRemanentes.toFixed(
            3
          )} m`,

          `diferencia ${Math.max(
            0,
            diferenciaMetros
          ).toFixed(3)} m`,
        ]
          .filter(Boolean)
          .join(" · ");

      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range:
          "TransformacionesProceso!A:O",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            [
              transformacionKey, // A
              timestamp, // B
              solicitudCorteId, // C
              OPEOrigen, // D
              inventarioOrigenKey, // E
              OTE, // F
              consecutivoCorte, // G
              productoSolicitado, // H
              cantidadOrigenUnd, // I
              cantidadObtenidaUnd, // J
              usuario, // K
              supervisorValido, // L
              turno, // M
              observacionTransformacion, // N
              "ACTIVO", // O
            ],
          ],
        },
      });
    }

    /* =======================================================
       4. CIERRE AUTOMÁTICO DE SOLICITUD DE CORTE

       Cuando el total procesado llega a la cantidad
       solicitada, PEX cambia automáticamente:

       Generada → Empacado

       De esta manera una persona ya no necesita marcar
       manualmente el ítem como Empacado.
       ======================================================= */

    let estadoItemFinal =
      estadoCorte;

    let itemCerradoAutomaticamente =
      false;

    if (
      pendienteDespues <= 0 &&
      norm(estadoCorte) ===
        "generada"
    ) {
      const colEstadoLetter =
        toColLetter(
          colEstadoItem
        );

      await sheets.spreadsheets.values.update({
        spreadsheetId,

        range:
          `SolicitudesCorte!${colEstadoLetter}${corteSheetRow}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {
          values: [
            ["Empacado"],
          ],
        },
      });

      estadoItemFinal =
        "Empacado";

      itemCerradoAutomaticamente =
        true;
    }

    /* =======================================================
       RESPUESTA
       ======================================================= */

    return NextResponse.json({
      success: true,

      transformacionKey,

      OTE,

      consecutivoCorte,

      solicitudCorteId,

      OPEOrigen,

      inventarioOrigenKey,

      cantidadOrigenUnd,

      cantidadObtenidaUnd,

      supervisor:
        supervisorValido,

      turno,

      movimientosCreados:
        movimientosNuevos.length,

      remanentesCreados:
        remanentesAgrupados.size,

      metrosOrigen,

      metrosProductoBueno,

      metrosRemanentes,

      diferenciaMetros:
        Math.max(
          0,
          diferenciaMetros
        ),

      cantidadSolicitada,

      obtenidoAnterior,

      pendienteAntes,

      pendienteDespues,

      /*
       * NUEVO:
       * permite que la interfaz sepa si esta operación
       * cerró automáticamente el consecutivo.
       */
      estadoItemAnterior:
        estadoCorte,

      estadoItemFinal,

      itemCerradoAutomaticamente,

      saldos:
        saldosFinales,
    });
  } catch (error) {
    console.error(
      "[POST control producto proceso - transformación]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "No fue posible registrar la transformación.",
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
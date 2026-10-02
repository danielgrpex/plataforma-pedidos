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
      index.get(
        normKey(key)
      );

    if (
      position !== undefined
    ) {
      return row[position];
    }
  }

  return "";
}

function toColLetter(index0: number) {
  let number =
    index0 + 1;

  let result = "";

  while (number > 0) {
    const remainder =
      (number - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder
      ) + result;

    number =
      Math.floor(
        (number - 1) / 26
      );
  }

  return result;
}

/* =========================================================
   PRODUCTOS
   ========================================================= */

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
    !Number.isFinite(number)
  ) {
    return 0;
  }

  if (unit === "mm") {
    return Math.round(number);
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

  let largoTexto =
    partes[3] || "";

  if (
    !parseLengthToMm(
      largoTexto
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
      largoTexto =
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
        largoTexto
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
   BODY
   ========================================================= */

type ConsumoBody = {
  componente: string;
  inventarioKey: string;
  cantidadConsumidaUnd: number;
};

type Body = {
  transformacionKey?: string;

  solicitudCorteId: string;
  cantidadObtenidaUnd: number;

  consumos: ConsumoBody[];

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

    const consumosBody =
      Array.isArray(
        body.consumos
      )
        ? body.consumos
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

    if (
      cantidadObtenidaUnd <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La cantidad final buena debe ser mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (
      !consumosBody.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debes seleccionar al menos un lote de componente.",
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
       VALIDAR SUPERVISOR
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

    /* =======================================================
       LEER DATOS
       ======================================================= */

    const sheets =
      await getSheetsClient();

    const spreadsheetId =
      env.SHEET_BASE_PRINCIPAL_ID;

    const timestamp =
      new Date().toISOString();

    const [
      corteResp,
      inventarioResp,
      movimientosResp,
      transformacionesResp,
      composicionValues,
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

      getInfoSheetRange(
        "ComposicionEmpaque!A:G"
      ),
    ]);

    const corteValues =
      (
        corteResp.data.values ||
        []
      ) as any[][];

    const inventarioValues =
      (
        inventarioResp.data.values ||
        []
      ) as any[][];

    const movimientosValues =
      (
        movimientosResp.data.values ||
        []
      ) as any[][];

    const transformacionesValues =
      (
        transformacionesResp.data.values ||
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
       SOLICITUD DE CORTE
       ======================================================= */

    const corteRow =
      corteRows.find(
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

    if (!corteRow) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La solicitud de corte no existe.",
        },
        { status: 404 }
      );
    }

    const estadoCorte =
      toStr(
        pickCell(
          corteRow,
          corteIdx,
          "estadoitem"
        )
      );

    if (
      norm(estadoCorte) !==
      "generada"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La solicitud de corte ya no está en estado Generada.",
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

    const productoFinal =
      parseProducto(
        productoSolicitado
      );

    if (
      !productoFinal.referencia ||
      !productoFinal.color ||
      !productoFinal.ancho ||
      !productoFinal.medidaMm
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
       IDEMPOTENCIA DE CABECERA
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

    if (transformacionExistente) {
      return NextResponse.json({
        success: true,
        idempotente: true,

        transformacionKey,
        OTE,
        consecutivoCorte,
        solicitudCorteId,

        cantidadSolicitada,
        cantidadObtenidaUnd:
          toInt(
            pickCell(
              transformacionExistente,
              transformacionesIdx,
              "cantidadObtenidaUnd"
            )
          ),

        message:
          "Esta operación ya había sido registrada.",
      });
    }

    /* =======================================================
       AVANCE ANTERIOR / PENDIENTE
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

      if (
        idSolicitud ===
          solicitudCorteId &&
        estado !== "anulado"
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

    /* =======================================================
       COMPOSICIÓN DEL PRODUCTO
       ======================================================= */

    const productoFinalBase =
      referenciaBase(
        productoSolicitado
      );

    const composicionRows =
      Array.isArray(
        composicionValues
      )
        ? composicionValues.slice(1)
        : [];

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
              toNumber(row?.[2]);

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
          success: false,
          message:
            "El producto no tiene composición configurada en ComposicionEmpaque.",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       NORMALIZAR / AGRUPAR CONSUMOS DEL BODY
       ======================================================= */

    const consumosAgrupados =
      new Map<
        string,
        {
          componente: string;
          inventarioKey: string;
          cantidadConsumidaUnd: number;
        }
      >();

    for (
      const consumo of
        consumosBody
    ) {
      const componente =
        toStr(
          consumo?.componente
        );

      const inventarioKey =
        toStr(
          consumo?.inventarioKey
        );

      const cantidad =
        toInt(
          consumo
            ?.cantidadConsumidaUnd
        );

      if (
        !componente ||
        !inventarioKey ||
        cantidad <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Todos los consumos deben tener componente, lote y cantidad mayor a 0.",
          },
          { status: 400 }
        );
      }

      const key =
        `${norm(
          componente
        )}|${inventarioKey}`;

      const actual =
        consumosAgrupados.get(
          key
        );

      if (actual) {
        actual.cantidadConsumidaUnd +=
          cantidad;
      } else {
        consumosAgrupados.set(
          key,
          {
            componente,
            inventarioKey,
            cantidadConsumidaUnd:
              cantidad,
          }
        );
      }
    }

    const consumos =
      Array.from(
        consumosAgrupados.values()
      );

    /* =======================================================
       RELACIONES EXISTENTES / KARDEX
       ======================================================= */

    const relacionesExistentes =
      new Set<string>();

    const saldoMovimiento =
      new Map<
        string,
        number
      >();

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

      if (
        estado === "anulado"
      ) {
        continue;
      }

      const inventarioKey =
        toStr(
          pickCell(
            row,
            movimientosIdx,
            "inventarioKey"
          )
        );

      if (!inventarioKey) {
        continue;
      }

      const cantidadMovimiento =
        toNumber(
          pickCell(
            row,
            movimientosIdx,
            "cantidadMovimiento"
          )
        );

      saldoMovimiento.set(
        inventarioKey,
        (
          saldoMovimiento.get(
            inventarioKey
          ) || 0
        ) +
          cantidadMovimiento
      );
    }

    /* =======================================================
       MAPA DE INVENTARIO
       ======================================================= */

    type InventarioMeta = {
      sheetRow: number;
      inventarioKey: string;
      OPE: string;
      producto: string;
      referencia: string;
      color: string;
      ancho: string;
      acabado: string;
      medidaMm: number;
      cantidadDisponibleHoja: number;
      estado: string;
    };

    const inventarioMap =
      new Map<
        string,
        InventarioMeta
      >();

    inventarioRows.forEach(
      (row, index) => {
        const inventarioKey =
          toStr(
            pickCell(
              row,
              inventarioIdx,
              "inventarioKey"
            )
          );

        if (!inventarioKey) {
          return;
        }

        const producto =
          toStr(
            pickCell(
              row,
              inventarioIdx,
              "producto"
            )
          );

        const parsed =
          parseProducto(
            producto
          );

        inventarioMap.set(
          inventarioKey,
          {
            sheetRow:
              index + 2,

            inventarioKey,

            OPE:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "OPE"
                )
              ),

            producto,

            referencia:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "referencia"
                )
              ) ||
              parsed.referencia,

            color:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "color"
                )
              ) ||
              parsed.color,

            ancho:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "ancho"
                )
              ) ||
              parsed.ancho,

            acabado:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "acabado"
                )
              ) ||
              parsed.acabado,

            medidaMm:
              toInt(
                pickCell(
                  row,
                  inventarioIdx,
                  "medida_mm",
                  "medidaMm"
                )
              ) ||
              parsed.medidaMm,

            cantidadDisponibleHoja:
              toNumber(
                pickCell(
                  row,
                  inventarioIdx,
                  "cantidadDisponible"
                )
              ),

            estado:
              toStr(
                pickCell(
                  row,
                  inventarioIdx,
                  "estado"
                )
              ),
          }
        );
      }
    );

    /* =======================================================
       VALIDAR CADA COMPONENTE Y CADA LOTE
       ======================================================= */

    type ResumenComponente = {
      componente: string;
      factorPorUnidad: number;
      necesarioTeorico: number;
      consumidoReal: number;
      diferencia: number;
      lotes: Array<{
        inventarioKey: string;
        OPE: string;
        cantidadConsumidaUnd: number;
      }>;
    };

    const resumenComponentes:
      ResumenComponente[] = [];

    const consumosValidados:
      Array<{
        componente: string;
        inventario: InventarioMeta;
        cantidadConsumidaUnd: number;
        relacion: string;
      }> = [];

    const componentesValidos =
      new Set(
        composicion.map(
          (item) =>
            norm(
              item!.componente
            )
        )
      );

    for (
      const consumo of
        consumos
    ) {
      if (
        !componentesValidos.has(
          norm(
            consumo.componente
          )
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `El componente "${consumo.componente}" no pertenece a la composición configurada.`,
          },
          { status: 400 }
        );
      }
    }

    for (
      const configRaw of
        composicion
    ) {
      const config =
        configRaw!;

      const colorObjetivo =
        config.colorComponente ||
        productoFinal.color;

      const anchoObjetivo =
        config.anchoComponente ||
        productoFinal.ancho;

      const medidaObjetivoMm =
        parseLengthToMm(
          config.largoComponente
        ) ||
        productoFinal.medidaMm;

      const acabadoObjetivo =
        config.acabadoComponente ||
        productoFinal.acabado;

      const consumosComponente =
        consumos.filter(
          (consumo) =>
            norm(
              consumo.componente
            ) ===
            norm(
              config.componente
            )
        );

      if (
        !consumosComponente.length
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Selecciona al menos un lote para el componente ${config.componente}.`,
          },
          { status: 400 }
        );
      }

      const necesarioTeorico =
        Math.ceil(
          cantidadObtenidaUnd *
            config.factorPorUnidad
        );

      let consumidoReal = 0;

      const lotesResumen:
        ResumenComponente["lotes"] =
        [];

      for (
        const consumo of
          consumosComponente
      ) {
        const inventario =
          inventarioMap.get(
            consumo.inventarioKey
          );

        if (!inventario) {
          return NextResponse.json(
            {
              success: false,
              message:
                `El lote ${consumo.inventarioKey} ya no existe en inventario.`,
            },
            { status: 404 }
          );
        }

        const compatible =
          norm(
            inventario.referencia
          ) ===
            norm(
              config.componente
            ) &&
          norm(
            inventario.color
          ) ===
            norm(
              colorObjetivo
            ) &&
          norm(
            inventario.ancho
          ) ===
            norm(
              anchoObjetivo
            ) &&
          inventario.medidaMm >=
            medidaObjetivoMm &&
          (
            !acabadoObjetivo ||
            norm(
              inventario.acabado
            ) ===
              norm(
                acabadoObjetivo
              )
          ) &&
          norm(
            inventario.estado
          ) !==
            "agotado";

        if (!compatible) {
          return NextResponse.json(
            {
              success: false,
              message:
                `El lote ${inventario.OPE} ya no es compatible con el componente ${config.componente}.`,
            },
            { status: 400 }
          );
        }

        const relacion =
          `${transformacionKey}|COMP|${inventario.inventarioKey}`;

        const yaRegistrado =
          relacionesExistentes.has(
            relacion
          );

        if (
          !yaRegistrado &&
          consumo.cantidadConsumidaUnd >
            inventario.cantidadDisponibleHoja
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `El lote ${inventario.OPE} solo tiene ${inventario.cantidadDisponibleHoja} und disponibles.`,
            },
            { status: 400 }
          );
        }

        consumidoReal +=
          consumo.cantidadConsumidaUnd;

        lotesResumen.push({
          inventarioKey:
            inventario.inventarioKey,

          OPE:
            inventario.OPE,

          cantidadConsumidaUnd:
            consumo.cantidadConsumidaUnd,
        });

        consumosValidados.push({
          componente:
            config.componente,

          inventario,

          cantidadConsumidaUnd:
            consumo.cantidadConsumidaUnd,

          relacion,
        });
      }

      if (
        consumidoReal <
        necesarioTeorico
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `El componente ${config.componente} requiere mínimo ${necesarioTeorico} und para obtener ${cantidadObtenidaUnd} und buenas. Solo registraste ${consumidoReal} und.`,
          },
          { status: 400 }
        );
      }

      resumenComponentes.push({
        componente:
          config.componente,

        factorPorUnidad:
          config.factorPorUnidad,

        necesarioTeorico,

        consumidoReal,

        diferencia:
          consumidoReal -
          necesarioTeorico,

        lotes:
          lotesResumen,
      });
    }

    /* =======================================================
       MOVIMIENTOS NUEVOS
       ======================================================= */

    const movimientosNuevos:
      any[][] = [];

    const deltaNuevo =
      new Map<
        string,
        number
      >();

    function agregarDelta(
      inventarioKey: string,
      cantidad: number
    ) {
      deltaNuevo.set(
        inventarioKey,
        (
          deltaNuevo.get(
            inventarioKey
          ) || 0
        ) + cantidad
      );
    }

    for (
      const consumo of
        consumosValidados
    ) {
      if (
        relacionesExistentes.has(
          consumo.relacion
        )
      ) {
        continue;
      }

      const inv =
        consumo.inventario;

      const observacionMovimiento =
        [
          "Consumo empaque compuesto",
          `Componente ${consumo.componente}`,
          `Solicitud ${solicitudCorteId}`,
          `Producto final ${productoSolicitado}`,
          observacion,
        ]
          .filter(Boolean)
          .join(" · ");

      movimientosNuevos.push([
        makeId("MOVPP"), // A
        timestamp, // B
        "CONSUMO_EMPAQUE_COMPONENTE", // C
        inv.OPE, // D
        OTE, // E
        consecutivoCorte, // F
        inv.producto, // G
        inv.referencia, // H
        inv.color, // I
        inv.ancho, // J
        inv.acabado, // K
        inv.medidaMm, // L
        -consumo.cantidadConsumidaUnd, // M
        inv.inventarioKey, // N
        transformacionKey, // O
        usuario, // P
        turno, // Q
        observacionMovimiento, // R
        consumo.relacion, // S
        "ACTIVO", // T
        supervisorValido, // U
      ]);

      agregarDelta(
        inv.inventarioKey,
        -consumo.cantidadConsumidaUnd
      );
    }

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
       ACTUALIZAR INVENTARIO
       ======================================================= */

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

    const inventariosAfectados =
      new Map<
        string,
        InventarioMeta
      >();

    consumosValidados.forEach(
      (consumo) => {
        inventariosAfectados.set(
          consumo.inventario
            .inventarioKey,
          consumo.inventario
        );
      }
    );

    const inventariosUpdate:
      Array<{
        range: string;
        values: any[][];
      }> = [];

    const saldosFinales:
      Array<{
        inventarioKey: string;
        OPE: string;
        producto: string;
        medida_mm: number;
        saldoDisponible: number;
      }> = [];

    for (
      const [
        inventarioKey,
        meta,
      ] of
        inventariosAfectados.entries()
    ) {
      /*
       * Si existe kardex para este inventario, lo usamos
       * como saldo base. Si es un registro histórico sin
       * movimientos, usamos el saldo actual de InventarioProceso.
       */
      const saldoBase =
        saldoMovimiento.has(
          inventarioKey
        )
          ? saldoMovimiento.get(
              inventarioKey
            ) || 0
          : meta
              .cantidadDisponibleHoja;

      const delta =
        deltaNuevo.get(
          inventarioKey
        ) || 0;

      const saldoFinal =
        saldoBase + delta;

      if (
        saldoFinal < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `El consumo dejaría el lote ${meta.OPE} con saldo negativo.`,
          },
          { status: 400 }
        );
      }

      const estadoFinal =
        saldoFinal > 0
          ? "Disponible"
          : "Agotado";

      inventariosUpdate.push(
        {
          range:
            `InventarioProceso!${toColLetter(
              colCantidad
            )}${meta.sheetRow}:${toColLetter(
              colCantidad
            )}${meta.sheetRow}`,

          values: [
            [saldoFinal],
          ],
        },
        {
          range:
            `InventarioProceso!${toColLetter(
              colFecha
            )}${meta.sheetRow}:${toColLetter(
              colFecha
            )}${meta.sheetRow}`,

          values: [
            [timestamp],
          ],
        },
        {
          range:
            `InventarioProceso!${toColLetter(
              colEstado
            )}${meta.sheetRow}:${toColLetter(
              colEstado
            )}${meta.sheetRow}`,

          values: [
            [estadoFinal],
          ],
        }
      );

      saldosFinales.push({
        inventarioKey,

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
       CABECERA DE TRANSFORMACIÓN
       ======================================================= */

    const totalConsumidoReal =
      resumenComponentes.reduce(
        (
          total,
          componente
        ) =>
          total +
          componente.consumidoReal,
        0
      );

    const detalleComponentes =
      resumenComponentes
        .map(
          (componente) => {
            const lotes =
              componente.lotes
                .map(
                  (lote) =>
                    `${lote.OPE}:${lote.cantidadConsumidaUnd}`
                )
                .join(",");

            return (
              `${componente.componente} ` +
              `${componente.consumidoReal}/${componente.necesarioTeorico} und ` +
              `[${lotes}]`
            );
          }
        )
        .join(" · ");

    const observacionTransformacion =
      [
        "Consumo compuesto",
        detalleComponentes,
        observacion,
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
            "MULTIPLE", // D OPEOrigen
            "MULTIPLE", // E inventarioOrigenKey
            OTE, // F
            consecutivoCorte, // G
            productoSolicitado, // H
            totalConsumidoReal, // I cantidadOrigenUnd
            cantidadObtenidaUnd, // J cantidadObtenidaUnd
            usuario, // K
            supervisorValido, // L
            turno, // M
            observacionTransformacion, // N
            "ACTIVO", // O
          ],
        ],
      },
    });

    /* =======================================================
       RESPUESTA
       ======================================================= */

    const pendienteDespues =
      Math.max(
        0,
        pendienteAntes -
          cantidadObtenidaUnd
      );

    /*
     * Sincronizar el avance operativo de SolicitudesCorte.
     *
     * L = cantidadResultanteUnd acumulada
     * M = estadoitem
     * O = usuario última actualización
     *
     * Mientras exista saldo pendiente, el ítem continúa
     * como Generada. Cuando llega a cero, Empaque es quien
     * lo cierra automáticamente como Empacado.
     */
    const cantidadResultanteAcumulada =
      Math.min(
        cantidadSolicitada,
        obtenidoAnterior +
          cantidadObtenidaUnd
      );

    const estadoItemFinal =
      pendienteDespues <= 0
        ? "Empacado"
        : "Generada";

    const corteSheetRow =
      corteRows.indexOf(
        corteRow
      ) + 2;

    if (corteSheetRow >= 2) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,

        requestBody: {
          valueInputOption:
            "USER_ENTERED",

          data: [
            {
              range:
                `SolicitudesCorte!L${corteSheetRow}:M${corteSheetRow}`,

              values: [
                [
                  cantidadResultanteAcumulada,
                  estadoItemFinal,
                ],
              ],
            },
            {
              range:
                `SolicitudesCorte!O${corteSheetRow}:O${corteSheetRow}`,

              values: [
                [usuario],
              ],
            },
          ],
        },
      });
    }

    return NextResponse.json({
      success: true,

      modo:
        "COMPUESTO",

      transformacionKey,

      OTE,

      consecutivoCorte,

      solicitudCorteId,

      cantidadSolicitada,

      obtenidoAnterior,

      pendienteAntes,

      cantidadOrigenUnd:
        totalConsumidoReal,

      cantidadObtenidaUnd,

      pendienteDespues,

      cantidadResultanteAcumulada,

      estadoitem:
        estadoItemFinal,

      supervisor:
        supervisorValido,

      turno,

      movimientosCreados:
        movimientosNuevos.length,

      remanentesCreados: 0,

      componentes:
        resumenComponentes,

      saldos:
        saldosFinales,
    });
  } catch (error) {
    console.error(
      "[POST control producto proceso - consumo compuesto]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "No fue posible registrar el consumo compuesto.",
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

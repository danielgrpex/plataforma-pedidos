import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import {
  getSheetsClient,
  getInfoSheetRange,
} from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
   ========================================================= */

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown) {
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : 0;
  }

  const s = toStr(v);

  if (!s) return 0;

  // Formato tipo 1.234,56
  if (s.includes(",") && s.includes(".")) {
    const n = Number(
      s.replace(/\./g, "").replace(",", ".")
    );

    return Number.isFinite(n) ? n : 0;
  }

  // Formato tipo 1234,56
  if (s.includes(",")) {
    const n = Number(s.replace(",", "."));

    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(s);

  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown) {
  return Math.max(
    0,
    Math.floor(toNum(v))
  );
}

function norm(s: unknown) {
  return toStr(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normKey(s: unknown) {
  return norm(s).replace(/\s+/g, "");
}

function makeId(prefix: string) {
  const rnd = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  const ts = Date.now()
    .toString(36)
    .toUpperCase();

  return `${prefix}_${ts}_${rnd}`;
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();

  headerRow.forEach((h, i) => {
    const k = normKey(h);

    if (k) {
      idx.set(k, i);
    }
  });

  return idx;
}

function pickCell(
  row: any[],
  idx: Map<string, number>,
  ...possibleKeys: string[]
) {
  for (const k of possibleKeys) {
    const i = idx.get(normKey(k));

    if (i !== undefined) {
      return row[i];
    }
  }

  return "";
}

function toColLetter(index0: number) {
  let n = index0 + 1;
  let result = "";

  while (n > 0) {
    const rem = (n - 1) % 26;

    result =
      String.fromCharCode(65 + rem) +
      result;

    n = Math.floor((n - 1) / 26);
  }

  return result;
}

/* =========================================================
   PRODUCTO / MEDIDA

   Ejemplo:
   Perfil Plano | Transparente | 4 cm | 1,21 m | Sin acabados
   ========================================================= */

function parseLengthToMm(text: string) {
  const value = toStr(text).toLowerCase();

  const match = value.match(
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i
  );

  if (!match) return 0;

  const number = Number(
    match[1].replace(",", ".")
  );

  if (!Number.isFinite(number)) {
    return 0;
  }

  const unit = match[2].toLowerCase();

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

function parseProductoKey(
  productoKey: string
) {
  const raw = toStr(productoKey);

  const partes = raw
    .split("|")
    .map((x) => x.trim());

  const color =
    partes[1] || "";

  const ancho =
    partes[2] || "";

  let largoTexto =
    partes[3] || "";

  /*
   * Fallback por si algún producto
   * no tiene exactamente la estructura esperada.
   */
  if (!parseLengthToMm(largoTexto)) {
    const posible = partes.find((p) =>
      /^\d+(?:[.,]\d+)?\s*m$/i.test(
        p.trim()
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
    producto: raw,
    referencia: "",
    color,
    ancho,
    acabado,
    medidaMm,
  };
}

/* =========================================================
   INVENTARIO KEY ESTABLE

   OPE + producto + medida
   siempre genera el mismo inventarioKey
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

type Body = {
  OPE: string;
  turno: string;
  supervisor: string;

  usuario?: string;
  observacion?: string;

  /*
   * La UI genera esta llave.
   * Evita duplicados si la misma petición
   * se repite accidentalmente.
   */
  entregaKey?: string;

  items: Array<{
    solicitudProdId: string;
    cantidadEntregadaUnd: number;
  }>;
};

/* =========================================================
   POST
   ========================================================= */

export async function POST(req: Request) {
  try {
    const body =
      (await req.json()) as Body;

    const OPE =
      toStr(body.OPE);

    const turno =
      toStr(body.turno);

    const supervisor =
      toStr(body.supervisor);

    const usuario =
      toStr(body.usuario) ||
      "produccion";

    const observacionGeneral =
      toStr(body.observacion);

    const entregaKey =
      toStr(body.entregaKey) ||
      makeId("ENTPP");

    const itemsBody =
      Array.isArray(body.items)
        ? body.items
        : [];

    // =========================================================
    // VALIDACIONES BÁSICAS
    // =========================================================

    if (!OPE) {
      return NextResponse.json(
        {
          success: false,
          message: "OPE requerida.",
        },
        {
          status: 400,
        }
      );
    }

    if (!turno) {
      return NextResponse.json(
        {
          success: false,
          message: "Turno requerido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!supervisor) {
      return NextResponse.json(
        {
          success: false,
          message: "Supervisor requerido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!itemsBody.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debes registrar al menos un ítem.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       VALIDAR QUE EL SUPERVISOR EXISTA EN INFORMACIÓN
       ========================================================= */

    const supervisoresValues =
      await getInfoSheetRange(
        "Supervisores!A:A"
      );

    const supervisoresValidos =
      supervisoresValues
        .slice(1)
        .map((row) =>
          toStr(row?.[0])
        )
        .filter(Boolean);

    const supervisorValido =
      supervisoresValidos.find(
        (nombre) =>
          norm(nombre) ===
          norm(supervisor)
      );

    if (!supervisorValido) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El supervisor seleccionado no existe en el catálogo de Supervisores.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Usamos exactamente el texto del catálogo.
     * Esto evita diferencias por mayúsculas/minúsculas.
     */
    const supervisorFinal =
      supervisorValido;

    // =========================================================
    // FILTRAR ITEMS CON CANTIDAD
    // =========================================================

    const itemsConCantidad =
      itemsBody.filter(
        (it) =>
          toStr(
            it.solicitudProdId
          ) &&
          toInt(
            it.cantidadEntregadaUnd
          ) > 0
      );

    if (!itemsConCantidad.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debes registrar una cantidad física mayor a 0.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Evita que un solicitudProdId venga
     * repetido dentro del mismo POST.
     */
    const idsVistos =
      new Set<string>();

    for (const it of itemsConCantidad) {
      const id =
        toStr(
          it.solicitudProdId
        );

      if (idsVistos.has(id)) {
        return NextResponse.json(
          {
            success: false,
            message:
              `La solicitud ${id} está repetida en la entrega.`,
          },
          {
            status: 400,
          }
        );
      }

      idsVistos.add(id);
    }

    // =========================================================
    // CLIENTE SHEETS
    // =========================================================

    const sheets =
      await getSheetsClient();

    const ts =
      new Date().toISOString();

    /* =========================================================
       1) LEER SOLICITUDES DE PRODUCCIÓN

       No confiamos en producto/cantidad enviados
       desde frontend.
       Volvemos a leer directamente desde Sheets.
       ========================================================= */

    const solResp =
      await sheets.spreadsheets.values.get({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "SolicitudesProduccion!A:J",

        valueRenderOption:
          "UNFORMATTED_VALUE",
      });

    const solValues =
      (solResp.data.values ||
        []) as any[][];

    if (solValues.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No hay información en SolicitudesProduccion.",
        },
        {
          status: 400,
        }
      );
    }

    const solHeader =
      solValues[0] || [];

    const solRows =
      solValues.slice(1);

    const solIdx =
      buildHeaderIndex(
        solHeader
      );

    const solicitudMap =
      new Map<
        string,
        any[]
      >();

    for (const row of solRows) {
      const id =
        toStr(
          pickCell(
            row,
            solIdx,
            "solicitudProdId"
          )
        );

      if (id) {
        solicitudMap.set(
          id,
          row
        );
      }
    }

    type ItemValidado = {
      solicitudProdId: string;

      productoKey: string;

      cantidadProgramadaUnd: number;

      cantidadEntregadaUnd: number;

      inventarioKey: string;

      producto: string;

      referencia: string;

      color: string;

      ancho: string;

      acabado: string;

      medidaMm: number;
    };

    const itemsValidados: ItemValidado[] =
      [];

    // =========================================================
    // VALIDAR CADA ITEM
    // =========================================================

    for (const it of itemsConCantidad) {
      const solicitudProdId =
        toStr(
          it.solicitudProdId
        );

      const row =
        solicitudMap.get(
          solicitudProdId
        );

      if (!row) {
        return NextResponse.json(
          {
            success: false,
            message:
              `No existe la solicitud ${solicitudProdId} en SolicitudesProduccion.`,
          },
          {
            status: 400,
          }
        );
      }

      const opeFila =
        toStr(
          pickCell(
            row,
            solIdx,
            "OPE"
          )
        );

      if (opeFila !== OPE) {
        return NextResponse.json(
          {
            success: false,
            message:
              `La solicitud ${solicitudProdId} no pertenece a ${OPE}.`,
          },
          {
            status: 400,
          }
        );
      }

      const estado =
        toStr(
          pickCell(
            row,
            solIdx,
            "estado"
          )
        );

      if (
        norm(estado) !==
        "generada"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `La solicitud ${solicitudProdId} ya no está en estado Generada.`,
          },
          {
            status: 400,
          }
        );
      }

      const productoKey =
        toStr(
          pickCell(
            row,
            solIdx,
            "productoKey"
          )
        );

      const cantidadProgramadaUnd =
        toInt(
          pickCell(
            row,
            solIdx,
            "cantidadUND"
          )
        );

      const productoInfo =
        parseProductoKey(
          productoKey
        );

      if (
        !productoInfo.medidaMm
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `No fue posible identificar la medida del producto: ${productoKey}`,
          },
          {
            status: 400,
          }
        );
      }

      const cantidadEntregadaUnd =
        toInt(
          it.cantidadEntregadaUnd
        );

      const inventarioKey =
        makeInventarioKey(
          OPE,
          productoInfo.producto,
          productoInfo.medidaMm
        );

      itemsValidados.push({
        solicitudProdId,

        productoKey,

        cantidadProgramadaUnd,

        cantidadEntregadaUnd,

        inventarioKey,

        ...productoInfo,
      });
    }

    /* =========================================================
       2) LEER MOVIMIENTOS E INVENTARIO ACTUAL
       ========================================================= */

    const [
      movResp,
      invResp,
    ] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "MovimientosProceso!A:U",

        valueRenderOption:
          "UNFORMATTED_VALUE",
      }),

      sheets.spreadsheets.values.get({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "InventarioProceso!A:K",

        valueRenderOption:
          "UNFORMATTED_VALUE",
      }),
    ]);

    const movValues =
      (movResp.data.values ||
        []) as any[][];

    const invValues =
      (invResp.data.values ||
        []) as any[][];

    const movHeader =
      movValues[0] || [];

    const movRows =
      movValues.length > 1
        ? movValues.slice(1)
        : [];

    const invHeader =
      invValues[0] || [];

    const invRows =
      invValues.length > 1
        ? invValues.slice(1)
        : [];

    const movIdx =
      buildHeaderIndex(
        movHeader
      );

    const invIdx =
      buildHeaderIndex(
        invHeader
      );

    /* =========================================================
       3) IDEMPOTENCIA

       Si llega otra vez la misma entregaKey,
       no duplicamos movimientos.
       ========================================================= */

    const relacionesExistentes =
      new Set<string>();

    for (const row of movRows) {
      const relacion =
        toStr(
          pickCell(
            row,
            movIdx,
            "movimientoRelacionado"
          )
        );

      if (relacion) {
        relacionesExistentes.add(
          relacion
        );
      }
    }

    /* =========================================================
       4) CREAR MOVIMIENTOS
       ========================================================= */

    const movRowsToAppend: any[][] =
      [];

    let movimientosYaExistentes =
      0;

    for (const item of itemsValidados) {
      const relacion =
        `${entregaKey}|${item.solicitudProdId}`;

      if (
        relacionesExistentes.has(
          relacion
        )
      ) {
        movimientosYaExistentes +=
          1;

        continue;
      }

      const observacionMovimiento =
        [
          "Entrega física supervisor",

          `Solicitud ${item.solicitudProdId}`,

          `Programado ${item.cantidadProgramadaUnd} und`,

          observacionGeneral,
        ]
          .filter(Boolean)
          .join(" · ");

      movRowsToAppend.push([
        makeId("MOVPP"), // A movimientoKey

        ts, // B timestamp

        "ENTRADA_PRODUCCION", // C tipoMovimiento

        OPE, // D OPE

        "", // E OTE

        "", // F consecutivoCorte

        item.producto, // G producto

        item.referencia, // H referencia

        item.color, // I color

        item.ancho, // J ancho

        item.acabado, // K acabado

        item.medidaMm, // L medida_mm

        item.cantidadEntregadaUnd, // M cantidadMovimiento

        item.inventarioKey, // N inventarioKey

        "", // O transformacionKey

        usuario, // P usuario técnico

        turno, // Q turno

        observacionMovimiento, // R observacion

        relacion, // S movimientoRelacionado

        "ACTIVO", // T estado

        supervisorFinal, // U supervisor real
      ]);
    }

    // =========================================================
    // APPEND MOVIMIENTOS
    // =========================================================

    if (movRowsToAppend.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "MovimientosProceso!A:U",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values:
            movRowsToAppend,
        },
      });
    }

    /* =========================================================
       5) RECALCULAR SALDOS DESDE EL KARDEX

       MovimientosProceso es la fuente de verdad.
       ========================================================= */

    const saldoPorInventario =
      new Map<string, number>();

    for (const row of movRows) {
      const estadoMovimiento =
        norm(
          pickCell(
            row,
            movIdx,
            "estado"
          )
        );

      if (
        estadoMovimiento ===
        "anulado"
      ) {
        continue;
      }

      const inventarioKey =
        toStr(
          pickCell(
            row,
            movIdx,
            "inventarioKey"
          )
        );

      if (!inventarioKey) {
        continue;
      }

      const cantidad =
        toNum(
          pickCell(
            row,
            movIdx,
            "cantidadMovimiento"
          )
        );

      saldoPorInventario.set(
        inventarioKey,

        (saldoPorInventario.get(
          inventarioKey
        ) || 0) + cantidad
      );
    }

    /*
     * Agregamos los movimientos recién creados
     * porque todavía no estaban en movRows.
     */
    for (const item of itemsValidados) {
      const relacion =
        `${entregaKey}|${item.solicitudProdId}`;

      if (
        relacionesExistentes.has(
          relacion
        )
      ) {
        continue;
      }

      saldoPorInventario.set(
        item.inventarioKey,

        (saldoPorInventario.get(
          item.inventarioKey
        ) || 0) +
          item.cantidadEntregadaUnd
      );
    }

    /* =========================================================
       6) MAPA INVENTARIO ACTUAL
       ========================================================= */

    const inventarioActualMap =
      new Map<
        string,
        {
          sheetRow: number;
          row: any[];
        }
      >();

    invRows.forEach(
      (row, i) => {
        const inventarioKey =
          toStr(
            pickCell(
              row,
              invIdx,
              "inventarioKey"
            )
          );

        if (!inventarioKey) {
          return;
        }

        inventarioActualMap.set(
          inventarioKey,
          {
            sheetRow: i + 2,
            row,
          }
        );
      }
    );

    const colCantidad =
      invIdx.get(
        normKey(
          "cantidadDisponible"
        )
      );

    const colFecha =
      invIdx.get(
        normKey(
          "fechaUltimoMovimiento"
        )
      );

    const colEstado =
      invIdx.get(
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

    /* =========================================================
       7) AGRUPAR POR INVENTARIO KEY

       Si una OPE tiene dos filas idénticas,
       comparten la misma existencia física.
       ========================================================= */

    const metaPorInventario =
      new Map<
        string,
        ItemValidado
      >();

    for (const item of itemsValidados) {
      if (
        !metaPorInventario.has(
          item.inventarioKey
        )
      ) {
        metaPorInventario.set(
          item.inventarioKey,
          item
        );
      }
    }

    const invAppend: any[][] =
      [];

    const invUpdates: Array<{
      range: string;
      values: any[][];
    }> = [];

    let inventariosCreados =
      0;

    let inventariosActualizados =
      0;

    const saldosRespuesta: Array<{
      inventarioKey: string;
      producto: string;
      medida_mm: number;
      saldoDisponible: number;
    }> = [];

    for (const [
      inventarioKey,
      meta,
    ] of metaPorInventario.entries()) {
      const saldo =
        saldoPorInventario.get(
          inventarioKey
        ) || 0;

      const estadoInventario =
        saldo > 0
          ? "Disponible"
          : saldo === 0
            ? "Agotado"
            : "REVISAR";

      const existente =
        inventarioActualMap.get(
          inventarioKey
        );

      if (!existente) {
        invAppend.push([
          inventarioKey, // A inventarioKey

          OPE, // B OPE

          meta.producto, // C producto

          meta.referencia, // D referencia

          meta.color, // E color

          meta.ancho, // F ancho

          meta.acabado, // G acabado

          meta.medidaMm, // H medida_mm

          saldo, // I cantidadDisponible

          ts, // J fechaUltimoMovimiento

          estadoInventario, // K estado
        ]);

        inventariosCreados +=
          1;
      } else {
        invUpdates.push(
          {
            range:
              `InventarioProceso!${toColLetter(
                colCantidad
              )}${existente.sheetRow}:${toColLetter(
                colCantidad
              )}${existente.sheetRow}`,

            values: [[saldo]],
          },

          {
            range:
              `InventarioProceso!${toColLetter(
                colFecha
              )}${existente.sheetRow}:${toColLetter(
                colFecha
              )}${existente.sheetRow}`,

            values: [[ts]],
          },

          {
            range:
              `InventarioProceso!${toColLetter(
                colEstado
              )}${existente.sheetRow}:${toColLetter(
                colEstado
              )}${existente.sheetRow}`,

            values: [[
              estadoInventario,
            ]],
          }
        );

        inventariosActualizados +=
          1;
      }

      saldosRespuesta.push({
        inventarioKey,

        producto:
          meta.producto,

        medida_mm:
          meta.medidaMm,

        saldoDisponible:
          saldo,
      });
    }

    // =========================================================
    // CREAR INVENTARIOS NUEVOS
    // =========================================================

    if (invAppend.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        range:
          "InventarioProceso!A:K",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values:
            invAppend,
        },
      });
    }

    // =========================================================
    // ACTUALIZAR INVENTARIOS EXISTENTES
    // =========================================================

    if (invUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId:
          env.SHEET_BASE_PRINCIPAL_ID,

        requestBody: {
          valueInputOption:
            "USER_ENTERED",

          data:
            invUpdates,
        },
      });
    }

    /* =========================================================
       8) RESPUESTA
       ========================================================= */

    return NextResponse.json({
      success: true,

      entregaKey,

      OPE,

      turno,

      supervisor:
        supervisorFinal,

      usuario,

      movimientosCreados:
        movRowsToAppend.length,

      movimientosYaExistentes,

      inventariosCreados,

      inventariosActualizados,

      saldos:
        saldosRespuesta,
    });
  } catch (error) {
    console.error(
      "[control-producto-proceso/entrega-produccion]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Error registrando entrega de producción.",
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
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
    const n = Number(text.replace(",", "."));

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

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();

  headerRow.forEach((header, index) => {
    const key = normKey(header);

    if (key) {
      idx.set(key, index);
    }
  });

  return idx;
}

function pickCell(
  row: any[],
  idx: Map<string, number>,
  ...keys: string[]
) {
  for (const key of keys) {
    const index = idx.get(normKey(key));

    if (index !== undefined) {
      return row[index];
    }
  }

  return "";
}

/* =========================================================
   PRODUCTO
   Ejemplo:
   Enganche Central | Blanco | 4 cm | 1,285 m | Sin acabados
   ========================================================= */

function parseLengthToMm(text: string) {
  const match = toStr(text).match(
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i
  );

  if (!match) return 0;

  const value = Number(
    match[1].replace(",", ".")
  );

  if (!Number.isFinite(value)) return 0;

  const unit = match[2].toLowerCase();

  if (unit === "mm") {
    return Math.round(value);
  }

  if (unit === "cm") {
    return Math.round(value * 10);
  }

  if (unit === "m") {
    return Math.round(value * 1000);
  }

  return 0;
}

function parseProducto(producto: string) {
  const raw = toStr(producto);

  const partes = raw
    .split("|")
    .map((parte) => parte.trim());

  const familia = partes[0] || "";
  const color = partes[1] || "";
  const ancho = partes[2] || "";

  let largoTexto = partes[3] || "";

  if (!parseLengthToMm(largoTexto)) {
    const posibleLargo = partes.find((parte) =>
      /^\d+(?:[.,]\d+)?\s*(mm|cm|m)$/i.test(
        parte.trim()
      )
    );

    if (posibleLargo) {
      largoTexto = posibleLargo;
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

/* =========================================================
   GET
   Puede recibir:

   ?solicitudCorteId=XXXX

   o para probar manualmente:

   ?ote=OTE260073&consecutivo=7005
   ========================================================= */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const solicitudCorteId = toStr(
      url.searchParams.get("solicitudCorteId")
    );

    const oteParametro = toStr(
      url.searchParams.get("ote")
    );

    const consecutivoParametro = toStr(
      url.searchParams.get("consecutivo")
    );

    if (
      !solicitudCorteId &&
      !(oteParametro && consecutivoParametro)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debes enviar solicitudCorteId o la combinación ote + consecutivo.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       1) LEER SOLICITUDES DE CORTE
       ========================================================= */

    const corteValues =
      await getBasePrincipalRange(
        "SolicitudesCorte!A:P"
      );

    if (!corteValues.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay información en SolicitudesCorte.",
        },
        {
          status: 404,
        }
      );
    }

    const corteHeader =
      corteValues[0] || [];

    const corteRows =
      corteValues.slice(1);

    const corteIdx =
      buildHeaderIndex(corteHeader);

    let corteEncontrado:
      | {
          row: any[];
          sheetRow: number;
        }
      | undefined;

    corteRows.forEach((row, index) => {
      if (corteEncontrado) return;

      const id = toStr(
        pickCell(
          row,
          corteIdx,
          "solicitudCorteId"
        )
      );

      const ote = toStr(
        pickCell(
          row,
          corteIdx,
          "OTE"
        )
      );

      const consecutivo = toStr(
        pickCell(
          row,
          corteIdx,
          "rowIndexPedido"
        )
      );

      const coincidePorId =
        solicitudCorteId &&
        id === solicitudCorteId;

      const coincidePorOte =
        oteParametro &&
        consecutivoParametro &&
        ote === oteParametro &&
        consecutivo === consecutivoParametro;

      if (
        coincidePorId ||
        coincidePorOte
      ) {
        corteEncontrado = {
          row,
          sheetRow: index + 2,
        };
      }
    });

    if (!corteEncontrado) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se encontró la solicitud de corte indicada.",
        },
        {
          status: 404,
        }
      );
    }

    const corteRow =
      corteEncontrado.row;

    const estadoitem = toStr(
      pickCell(
        corteRow,
        corteIdx,
        "estadoitem"
      )
    );

    if (norm(estadoitem) !== "generada") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La solicitud de corte ya no está en estado Generada.",
        },
        {
          status: 400,
        }
      );
    }

    const item = {
      sheetRow:
        corteEncontrado.sheetRow,

      solicitudCorteId: toStr(
        pickCell(
          corteRow,
          corteIdx,
          "solicitudCorteId"
        )
      ),

      OTE: toStr(
        pickCell(
          corteRow,
          corteIdx,
          "OTE"
        )
      ),

      rowIndexPedido: toStr(
        pickCell(
          corteRow,
          corteIdx,
          "rowIndexPedido"
        )
      ),

      productoSolicitado: toStr(
        pickCell(
          corteRow,
          corteIdx,
          "productoSolicitado"
        )
      ),

      cantidadSolicitadaUnd: toNumber(
        pickCell(
          corteRow,
          corteIdx,
          "cantidadSolicitadaUnd"
        )
      ),

      estadoitem,
    };

    const productoObjetivo =
      parseProducto(
        item.productoSolicitado
      );

    if (
      !productoObjetivo.familia ||
      !productoObjetivo.color ||
      !productoObjetivo.ancho ||
      !productoObjetivo.medidaMm
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `No fue posible interpretar completamente el producto solicitado: ${item.productoSolicitado}`,
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       2) LEER INVENTARIO DE PROCESO
       ========================================================= */

    const invValues =
      await getBasePrincipalRange(
        "InventarioProceso!A:K"
      );

    if (!invValues.length) {
      return NextResponse.json({
        ok: true,
        item,
        productoObjetivo,
        totalCompatibles: 0,
        compatibles: [],
      });
    }

    const invHeader =
      invValues[0] || [];

    const invRows =
      invValues.slice(1);

    const invIdx =
      buildHeaderIndex(invHeader);

    const disponibles = invRows
      .map((row, index) => {
        const producto = toStr(
          pickCell(
            row,
            invIdx,
            "producto"
          )
        );

        const parsed =
          parseProducto(producto);

        return {
          sheetRow: index + 2,

          inventarioKey: toStr(
            pickCell(
              row,
              invIdx,
              "inventarioKey"
            )
          ),

          OPE: toStr(
            pickCell(
              row,
              invIdx,
              "OPE"
            )
          ),

          producto,

          referencia: toStr(
            pickCell(
              row,
              invIdx,
              "referencia"
            )
          ),

          color: toStr(
            pickCell(
              row,
              invIdx,
              "color"
            )
          ),

          ancho: toStr(
            pickCell(
              row,
              invIdx,
              "ancho"
            )
          ),

          acabado: toStr(
            pickCell(
              row,
              invIdx,
              "acabado"
            )
          ),

          medida_mm: toNumber(
            pickCell(
              row,
              invIdx,
              "medida_mm"
            )
          ),

          cantidadDisponible: toNumber(
            pickCell(
              row,
              invIdx,
              "cantidadDisponible"
            )
          ),

          fechaUltimoMovimiento: toStr(
            pickCell(
              row,
              invIdx,
              "fechaUltimoMovimiento"
            )
          ),

          estado: toStr(
            pickCell(
              row,
              invIdx,
              "estado"
            )
          ),

          familiaOrigen:
            parsed.familia,

          colorOrigen:
            parsed.color,

          anchoOrigen:
            parsed.ancho,
        };
      })
      .filter(
        (inv) =>
          inv.inventarioKey &&
          inv.cantidadDisponible > 0
      );

    /* =========================================================
       3) COMPATIBILIDAD BASE

       Para comenzar:
       - misma familia
       - mismo color
       - mismo ancho
       - longitud origen >= longitud final

       NO exigimos mismo acabado porque precisamente
       empaque puede aplicar adhesivo, marca, ensamble, etc.
       ========================================================= */

    const compatibles =
      disponibles
        .filter((inv) => {
          const mismaFamilia =
            norm(inv.familiaOrigen) ===
            norm(productoObjetivo.familia);

          const mismoColor =
            norm(inv.colorOrigen) ===
            norm(productoObjetivo.color);

          const mismoAncho =
            norm(inv.anchoOrigen) ===
            norm(productoObjetivo.ancho);

          const largoSuficiente =
            inv.medida_mm >=
            productoObjetivo.medidaMm;

          return (
            mismaFamilia &&
            mismoColor &&
            mismoAncho &&
            largoSuficiente
          );
        })
        .sort((a, b) => {
          /*
           * Solo orden visual:
           * primero por OPE y después por medida.
           * No significa que PEX esté recomendando cuál usar.
           */
          const opeCompare =
            b.OPE.localeCompare(
              a.OPE,
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              }
            );

          if (opeCompare !== 0) {
            return opeCompare;
          }

          return (
            a.medida_mm -
            b.medida_mm
          );
        });

    return NextResponse.json(
      {
        ok: true,

        item,

        productoObjetivo: {
          familia:
            productoObjetivo.familia,

          color:
            productoObjetivo.color,

          ancho:
            productoObjetivo.ancho,

          medidaFinal_mm:
            productoObjetivo.medidaMm,

          acabadoFinal:
            productoObjetivo.acabado,
        },

        totalDisponibles:
          disponibles.length,

        totalCompatibles:
          compatibles.length,

        compatibles,
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
      "[GET control producto proceso - inventario compatible]",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "No fue posible consultar el producto en proceso compatible.",
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
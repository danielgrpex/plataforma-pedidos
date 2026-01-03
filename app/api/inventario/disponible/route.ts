// app/api/inventario/disponible/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function norm(v: unknown) {
  return toStr(v).toLowerCase();
}

function toNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = norm(h);
    if (key) idx.set(key, i);
  });
  return idx;
}

function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}

type Lot = {
  inventarioId: string;
  tipoInventario: string;
  almacen: string;
  productoKey: string;
  productoDescripcion: string;

  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  acabados: string;

  unidadBase: string;

  disponibleUnd: number;
  disponibleM: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // filtros
    const productoKey = toStr(searchParams.get("productoKey"));
    const almacen = toStr(searchParams.get("almacen"));
    const tipoInventario = toStr(searchParams.get("tipoInventario"));

    // filtros “por campos” (para match compatible)
    const referencia = toStr(searchParams.get("referencia"));
    const color = toStr(searchParams.get("color"));
    const ancho = toStr(searchParams.get("ancho"));
    const largo = toStr(searchParams.get("largo"));
    const acabados = toStr(searchParams.get("acabados"));

    // exact = exige acabados (si se pasan)
    // compatible = ignora acabados
    const match = (toStr(searchParams.get("match")) || "exact").toLowerCase(); // exact | compatible

    const sheets = await getSheetsClient();

    /* =========================
       INVENTARIO
    ========================= */
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invValues = (invResp.data.values || []) as any[][];
    if (invValues.length <= 1) {
      return NextResponse.json({
        success: true,
        filters: { productoKey, almacen, tipoInventario, referencia, color, ancho, largo, acabados, match },
        totals: { und: 0, m: 0 },
        resumen: [],
        lots: [],
      });
    }

    const invHeader = invValues[0];
    const invIdx = buildHeaderIndex(invHeader);
    const invRows = invValues.slice(1);

    const inventarioBase = invRows
      .map((r) => {
        const inventarioId = toStr(pick(r, invIdx, "inventarioId"));
        const tipoInventario = toStr(pick(r, invIdx, "tipoInventario"));
        const almacen = toStr(pick(r, invIdx, "almacen"));
        const productoKey = toStr(pick(r, invIdx, "productoKey"));
        const productoDescripcion = toStr(pick(r, invIdx, "productoDescripcion"));

        const referencia = toStr(pick(r, invIdx, "referencia"));
        const color = toStr(pick(r, invIdx, "color"));
        const ancho = toStr(pick(r, invIdx, "ancho"));
        const largo = toStr(pick(r, invIdx, "largo"));
        const acabados = toStr(pick(r, invIdx, "acabados"));

        const unidadBase = toStr(pick(r, invIdx, "unidadBase"));
        const cantidadInicialUnd = toNumber(pick(r, invIdx, "cantidadInicialUnd"));
        const cantidadInicialM = toNumber(pick(r, invIdx, "cantidadInicialM"));
        const estadoInventario = toStr(pick(r, invIdx, "estadoInventario"));

        return {
          inventarioId,
          tipoInventario,
          almacen,
          productoKey,
          productoDescripcion,
          referencia,
          color,
          ancho,
          largo,
          acabados,
          unidadBase,
          cantidadInicialUnd,
          cantidadInicialM,
          estadoInventario,
        };
      })
      .filter((x) => x.inventarioId && (x.productoKey || x.referencia))
      .filter((x) => {
        const st = x.estadoInventario.toLowerCase();
        if (st.includes("consumido")) return false;
        if (st.includes("no conforme")) return false;
        // por defecto solo “Disponible” si existe esa palabra
        if (st && !st.includes("disponible")) return false;
        return true;
      });

    /* =========================
       MOVIMIENTOS
    ========================= */
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];
    const movHeader = movValues.length ? movValues[0] : [];
    const movIdx = buildHeaderIndex(movHeader);

    const movSum = new Map<string, { und: number; m: number }>();

    for (const r of movRows) {
      const invId = toStr(pick(r, movIdx, "inventarioId"));
      if (!invId) continue;

      const und = toNumber(pick(r, movIdx, "cantidadUnd"));
      const m = toNumber(pick(r, movIdx, "cantidadM"));

      const curr = movSum.get(invId) || { und: 0, m: 0 };
      curr.und += und;
      curr.m += m;
      movSum.set(invId, curr);
    }

    /* =========================
       AJUSTES
    ========================= */
    const adjResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "AjustesInventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const adjValues = (adjResp.data.values || []) as any[][];
    const adjRows = adjValues.length > 1 ? adjValues.slice(1) : [];
    const adjHeader = adjValues.length ? adjValues[0] : [];
    const adjIdx = buildHeaderIndex(adjHeader);

    const adjExtra = new Map<string, { und: number; m: number }>();

    for (const r of adjRows) {
      const invId = toStr(pick(r, adjIdx, "inventarioId"));
      if (!invId) continue;

      const movimientoId = toStr(pick(r, adjIdx, "movimientoId"));
      if (movimientoId) continue; // evita doble conteo

      const und = toNumber(pick(r, adjIdx, "cantidadAjusteUnd"));
      const m = toNumber(pick(r, adjIdx, "cantidadAjusteM"));

      const curr = adjExtra.get(invId) || { und: 0, m: 0 };
      curr.und += und;
      curr.m += m;
      adjExtra.set(invId, curr);
    }

    /* =========================
       LOTES DISPONIBLES
    ========================= */
    let lots: Lot[] = inventarioBase.map((it) => {
      const mov = movSum.get(it.inventarioId) || { und: 0, m: 0 };
      const adj = adjExtra.get(it.inventarioId) || { und: 0, m: 0 };

      const disponibleUnd = it.cantidadInicialUnd + mov.und + adj.und;
      const disponibleM = it.cantidadInicialM + mov.m + adj.m;

      return {
        inventarioId: it.inventarioId,
        tipoInventario: it.tipoInventario,
        almacen: it.almacen,
        productoKey: it.productoKey,
        productoDescripcion: it.productoDescripcion,
        referencia: it.referencia,
        color: it.color,
        ancho: it.ancho,
        largo: it.largo,
        acabados: it.acabados,
        unidadBase: it.unidadBase,
        disponibleUnd,
        disponibleM,
      };
    });

    // filtrar: por productoKey exacto o por campos
    if (productoKey) lots = lots.filter((x) => x.productoKey === productoKey);

    if (referencia) lots = lots.filter((x) => x.referencia === referencia);
    if (color) lots = lots.filter((x) => x.color === color);
    if (ancho) lots = lots.filter((x) => toStr(x.ancho) === ancho);
    if (largo) lots = lots.filter((x) => toStr(x.largo) === largo);

    if (match === "exact" && acabados) {
      lots = lots.filter((x) => norm(x.acabados) === norm(acabados));
    }
    // match=compatible => ignora acabados

    if (almacen) lots = lots.filter((x) => x.almacen === almacen);
    if (tipoInventario) lots = lots.filter((x) => x.tipoInventario === tipoInventario);

    // solo positivos
    lots = lots.filter((x) => x.disponibleUnd > 0 || x.disponibleM > 0);

    // totales
    const totals = lots.reduce(
      (acc, x) => {
        acc.und += x.disponibleUnd;
        acc.m += x.disponibleM;
        return acc;
      },
      { und: 0, m: 0 }
    );

    // resumen por productoKey (útil)
    const byProductoKey = new Map<
      string,
      { productoKey: string; productoDescripcion: string; und: number; m: number }
    >();

    for (const l of lots) {
      const key = l.productoKey || `${l.referencia}|${l.color}|${l.ancho}|${l.largo}`;
      const curr = byProductoKey.get(key) || {
        productoKey: key,
        productoDescripcion: l.productoDescripcion,
        und: 0,
        m: 0,
      };
      curr.und += l.disponibleUnd;
      curr.m += l.disponibleM;
      byProductoKey.set(key, curr);
    }

    const resumen = Array.from(byProductoKey.values()).sort((a, b) =>
      a.productoKey.localeCompare(b.productoKey)
    );

    return NextResponse.json({
      success: true,
      filters: { productoKey, almacen, tipoInventario, referencia, color, ancho, largo, acabados, match },
      totals,
      resumen,
      lots,
    });
  } catch (error) {
    console.error("[inventario/disponible]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error calculando inventario disponible",
      },
      { status: 500 }
    );
  }
}

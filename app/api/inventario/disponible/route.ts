import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
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

type InvRow = {
  inventarioId: string;
  tipoInventario: string; // MP | PEP | PT
  almacen: string; // Materia Prima e Insumos | Producto en Proceso | Producto Terminado
  productoKey: string;
  productoDescripcion: string;
  unidadBase: string; // UND | M

  cantidadInicialUnd: number;
  cantidadInicialM: number;

  estadoInventario: string; // Disponible | ...
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const productoKey = toStr(searchParams.get("productoKey"));
    const almacen = toStr(searchParams.get("almacen"));
    const tipoInventario = toStr(searchParams.get("tipoInventario"));

    const sheets = await getSheetsClient();

    // ✅ Inventario (A:AB = 28 columnas, según tu estructura)
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invValues = (invResp.data.values || []) as any[][];
    if (invValues.length <= 1) {
      return NextResponse.json({ success: true, totals: { und: 0, m: 0 }, lots: [] });
    }

    const invRowsRaw = invValues.slice(1);

    // Mapeo por índice
    const inventario: InvRow[] = invRowsRaw
      .map((r) => {
        const inventarioId = toStr(r[0]); // A
        const tipoInventario = toStr(r[1]); // B
        const almacen = toStr(r[2]); // C
        const productoKey = toStr(r[3]); // D
        const productoDescripcion = toStr(r[4]); // E
        const unidadBase = toStr(r[9]); // J

        const cantidadInicialUnd = toNumber(r[10]); // K
        const cantidadInicialM = toNumber(r[11]); // L

        const estadoInventario = toStr(r[16]); // Q

        return {
          inventarioId,
          tipoInventario,
          almacen,
          productoKey,
          productoDescripcion,
          unidadBase,
          cantidadInicialUnd,
          cantidadInicialM,
          estadoInventario,
        };
      })
      // Filtritos básicos (puedes ajustarlos después)
      .filter((x) => x.inventarioId && x.productoKey)
      .filter((x) => {
        const st = x.estadoInventario.toLowerCase();
        // Excluimos consumido / no conforme por defecto
        if (st.includes("consumido")) return false;
        if (st.includes("no conforme")) return false;
        return true;
      });

    // ✅ MovimientosInventario (A:L = 12 cols)
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // Sumatoria por inventarioId
    const movSum = new Map<string, { und: number; m: number }>();
    for (const r of movRows) {
      const invId = toStr(r[1]); // inventarioId
      if (!invId) continue;

      const und = toNumber(r[3]); // cantidadUnd
      const m = toNumber(r[4]); // cantidadM

      const curr = movSum.get(invId) || { und: 0, m: 0 };
      curr.und += und;
      curr.m += m;
      movSum.set(invId, curr);
    }

    // ✅ AjustesInventario (A:J = 10 cols)
    // Solo sumamos ajustes que NO tengan movimientoId, para evitar duplicar
    const adjResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "AjustesInventario!A:J",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const adjValues = (adjResp.data.values || []) as any[][];
    const adjRows = adjValues.length > 1 ? adjValues.slice(1) : [];

    const adjExtra = new Map<string, { und: number; m: number }>();
    for (const r of adjRows) {
      const invId = toStr(r[1]); // inventarioId
      if (!invId) continue;

      const movimientoId = toStr(r[9]); // movimientoId (col J)
      if (movimientoId) continue; // si ya tiene movimiento, no lo contamos aquí

      const und = toNumber(r[3]); // cantidadAjusteUnd
      const m = toNumber(r[4]); // cantidadAjusteM

      const curr = adjExtra.get(invId) || { und: 0, m: 0 };
      curr.und += und;
      curr.m += m;
      adjExtra.set(invId, curr);
    }

    // ✅ Construimos lotes con disponible = inicial + movimientos + ajustesSinMovimiento
    let lots = inventario.map((it) => {
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
        unidadBase: it.unidadBase,
        disponibleUnd,
        disponibleM,
      };
    });

    // ✅ filtros por query
    if (productoKey) lots = lots.filter((x) => x.productoKey === productoKey);
    if (almacen) lots = lots.filter((x) => x.almacen === almacen);
    if (tipoInventario) lots = lots.filter((x) => x.tipoInventario === tipoInventario);

    // Solo lotes con algo disponible (opcional: si quieres ver ceros, me dices)
    lots = lots.filter((x) => x.disponibleUnd !== 0 || x.disponibleM !== 0);

    // ✅ Totales
    const totals = lots.reduce(
      (acc, x) => {
        acc.und += x.disponibleUnd;
        acc.m += x.disponibleM;
        return acc;
      },
      { und: 0, m: 0 }
    );

    // ✅ También devolvemos un resumen agrupado por productoKey (útil para Planeación)
    const byProductoKey = new Map<string, { productoKey: string; productoDescripcion: string; und: number; m: number }>();
    for (const l of lots) {
      const curr = byProductoKey.get(l.productoKey) || {
        productoKey: l.productoKey,
        productoDescripcion: l.productoDescripcion,
        und: 0,
        m: 0,
      };
      curr.und += l.disponibleUnd;
      curr.m += l.disponibleM;
      byProductoKey.set(l.productoKey, curr);
    }

    const resumen = Array.from(byProductoKey.values()).sort((a, b) =>
      a.productoKey.localeCompare(b.productoKey)
    );

    return NextResponse.json({
      success: true,
      filters: { productoKey, almacen, tipoInventario },
      totals,
      resumen,
      lots,
    });
  } catch (error) {
    console.error("[inventario/disponible]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error calculando inventario disponible",
      },
      { status: 500 }
    );
  }
}

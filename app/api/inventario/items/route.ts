//app/api/inventario/items/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
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

type InvItem = {
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
  estadoInventario: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // filtros opcionales para la UI
    const q = norm(searchParams.get("q"));
    const almacen = toStr(searchParams.get("almacen"));
    const tipoInventario = toStr(searchParams.get("tipoInventario"));
    const soloDisponibles = (toStr(searchParams.get("soloDisponibles")) || "true").toLowerCase() !== "false";

    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:ZZ",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json([], {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0" },
      });
    }

    const header = values[0];
    const idx = buildHeaderIndex(header);
    const rows = values.slice(1);

    let list: InvItem[] = rows
      .map((r) => ({
        inventarioId: toStr(pick(r, idx, "inventarioId")),
        tipoInventario: toStr(pick(r, idx, "tipoInventario")),
        almacen: toStr(pick(r, idx, "almacen")),
        productoKey: toStr(pick(r, idx, "productoKey")),
        productoDescripcion: toStr(pick(r, idx, "productoDescripcion")),
        referencia: toStr(pick(r, idx, "referencia")),
        color: toStr(pick(r, idx, "color")),
        ancho: toStr(pick(r, idx, "ancho")),
        largo: toStr(pick(r, idx, "largo")),
        acabados: toStr(pick(r, idx, "acabados")),
        unidadBase: toStr(pick(r, idx, "unidadBase")),
        estadoInventario: toStr(pick(r, idx, "estadoInventario")),
      }))
      .filter((x) => x.inventarioId && (x.productoKey || x.referencia || x.productoDescripcion));

    if (almacen) list = list.filter((x) => x.almacen === almacen);
    if (tipoInventario) list = list.filter((x) => x.tipoInventario === tipoInventario);

    if (soloDisponibles) {
      list = list.filter((x) => {
        const st = norm(x.estadoInventario);
        if (st.includes("consumido")) return false;
        if (st.includes("no conforme")) return false;
        if (st && !st.includes("disponible")) return false;
        return true;
      });
    }

    if (q) {
      list = list.filter((x) => {
        const hay = `${norm(x.inventarioId)} ${norm(x.productoKey)} ${norm(x.productoDescripcion)} ${norm(x.referencia)} ${norm(x.color)} ${norm(x.ancho)} ${norm(x.largo)} ${norm(x.acabados)}`;
        return hay.includes(q);
      });
    }

    // orden por descripción y luego id
    list.sort((a, b) => {
      const d = a.productoDescripcion.localeCompare(b.productoDescripcion);
      return d !== 0 ? d : a.inventarioId.localeCompare(b.inventarioId);
    });

    return NextResponse.json(list, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0" },
    });
  } catch (e) {
    console.error("[GET inventario/items]", e);
    return NextResponse.json(
      { error: "Error listando items de Inventario" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

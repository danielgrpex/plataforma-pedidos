// app/api/planeacion/programacion/solicitudes/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function canon(v: unknown) {
  return toStr(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]+/g, "");
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = canon(h);
    if (key) idx.set(key, i);
  });
  return idx;
}

function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(canon(col));
  return i === undefined ? "" : row[i];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = toStr(searchParams.get("estado")) || "Pendiente";
    const q = canon(searchParams.get("q") || "");

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) return NextResponse.json({ success: true, items: [] });

    const header = values[0] || [];
    const idx = buildHeaderIndex(header);
    const rows = values.slice(1);

    const hasHeaders =
      idx.has("solicitudprodid") &&
      idx.has("pedidokey") &&
      idx.has("rowindexpedido") &&
      idx.has("productokey") &&
      idx.has("cantidadund") &&
      idx.has("estado") &&
      idx.has("fechacreacion") &&
      idx.has("fechaultactualizacion") &&
      idx.has("usuario") &&
      idx.has("ope");

    let items = rows.map((r) => {
      if (hasHeaders) {
        return {
          solicitudProdId: toStr(pick(r, idx, "solicitudProdId")),
          pedidoKey: toStr(pick(r, idx, "pedidoKey")),
          rowIndexPedido: toStr(pick(r, idx, "rowIndexPedido")),
          productoKey: toStr(pick(r, idx, "productoKey")),
          cantidadUND: toStr(pick(r, idx, "cantidadUND")),
          estado: toStr(pick(r, idx, "estado")),
          fechaCreacion: toStr(pick(r, idx, "fechaCreacion")),
          fechaUltActualizacion: toStr(pick(r, idx, "fechaUltActualizacion")),
          usuario: toStr(pick(r, idx, "usuario")),
          OPE: toStr(pick(r, idx, "OPE")),
        };
      }

      // Fallback por posición A..J (como definiste)
      return {
        solicitudProdId: toStr(r[0]),
        pedidoKey: toStr(r[1]),
        rowIndexPedido: toStr(r[2]),
        productoKey: toStr(r[3]),
        cantidadUND: toStr(r[4]),
        estado: toStr(r[5]),
        fechaCreacion: toStr(r[6]),
        fechaUltActualizacion: toStr(r[7]),
        usuario: toStr(r[8]),
        OPE: toStr(r[9]),
      };
    });

    items = items.filter((x) => x.solicitudProdId);

    if (estado) items = items.filter((x) => canon(x.estado) === canon(estado));

    if (q) {
      items = items.filter((x) => {
        const blob = canon(
          [
            x.solicitudProdId,
            x.pedidoKey,
            x.rowIndexPedido,
            x.productoKey,
            x.cantidadUND,
            x.estado,
            x.usuario,
            x.OPE,
          ].join(" ")
        );
        return blob.includes(q);
      });
    }

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[planeacion/programacion/solicitudes]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error listando solicitudes" },
      { status: 500 }
    );
  }
}

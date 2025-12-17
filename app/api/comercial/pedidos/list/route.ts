import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

type PedidoListItem = {
  consecutivo: string;
  fechaSolicitud: string;
  asesor: string;
  cliente: string;
  oc: string;
  estado: string;
  pdfPath: string;
  createdBy: string;

  // ✅ NUEVO (AL)
  pedidoKey: string;

  // opcional (AM)
  pedidoId?: string;

  // opcional: para mostrar resumen si quieres
  itemsCount?: number;
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);
    const q = toStr(searchParams.get("q") || "");
    const estado = toStr(searchParams.get("estado") || "");

    const sheets = await getSheetsClient();

    // ✅ Ahora leemos hasta AM para incluir:
    // AL = pedidoKey (index 37)
    // AM = pedidoId  (index 38)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: true, items: [] });
    }

    const rows = values.slice(1); // saltar header

    // 1) Mapear filas (cada fila sigue siendo un producto)
    let flat: PedidoListItem[] = rows.map((r) => {
      const consecutivo = toStr(r[0]);
      const fechaSolicitud = toStr(r[1]);
      const asesor = toStr(r[2]);
      const cliente = toStr(r[3]);
      const oc = toStr(r[5]);          // F
      const estadoRow = toStr(r[23]);  // X
      const pdfPath = toStr(r[35]);    // AJ
      const createdBy = toStr(r[36]);  // AK

      const pedidoKey = toStr(r[37]);  // ✅ AL
      const pedidoId = toStr(r[38]);   // ✅ AM

      return {
        consecutivo,
        fechaSolicitud,
        asesor,
        cliente,
        oc,
        estado: estadoRow,
        pdfPath,
        createdBy,
        pedidoKey,
        pedidoId: pedidoId || undefined,
      };
    });

    // 2) Filtros (sobre filas)
    if (estado) {
      const est = estado.toLowerCase();
      flat = flat.filter((i) => i.estado.toLowerCase() === est);
    }

    if (q) {
      const qq = q.toLowerCase();
      flat = flat.filter((i) => {
        return (
          i.consecutivo.toLowerCase().includes(qq) ||
          i.cliente.toLowerCase().includes(qq) ||
          i.oc.toLowerCase().includes(qq) ||
          i.asesor.toLowerCase().includes(qq)
        );
      });
    }

    // 3) ✅ Dedupe: 1 fila por pedidoKey (para que el listado no se repita por producto)
    //    y añadimos itemsCount (cuántos productos tiene ese pedido)
    const map = new Map<string, PedidoListItem>();

    for (const r of flat) {
      const key = r.pedidoKey || `${r.cliente}|${r.oc}|${r.consecutivo}`; // fallback
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { ...r, itemsCount: 1 });
      } else {
        existing.itemsCount = (existing.itemsCount || 0) + 1;

        // opcional: si un item tiene pdfPath y el primero no, conservar el que sí
        if (!existing.pdfPath && r.pdfPath) existing.pdfPath = r.pdfPath;

        // opcional: conservar estado "más avanzado" si te interesa (por ahora no tocamos)
      }
    }

    // 4) Orden: últimos primero (manteniendo tu comportamiento)
    let items = Array.from(map.values()).reverse();

    // 5) Paginar (simple)
    items = items.slice(0, limit);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[pedidos/list]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error listando pedidos" },
      { status: 500 }
    );
  }
}

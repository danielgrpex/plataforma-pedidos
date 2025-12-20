import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function isTrue(v: unknown) {
  const s = toStr(v).toLowerCase();
  return s === "true" || s === "1" || s === "si" || s === "sí";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = toStr(searchParams.get("q"));

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: true, items: [] });
    }

    const rows = values.slice(1);

    /**
     * Índices IMPORTANTES (0-based)
     * X  = 23 → Estado
     * V  = 21 → Revisado Planeación
     * AL = 37 → pedidoKey
     */
    const map = new Map<string, any>();

    for (const r of rows) {
      const pedidoKey = toStr(r[37]);
      if (!pedidoKey) continue;

      const estadoPedido = toStr(r[23]); // ✅ ESTADO REAL
      const revisadoPlaneacion = isTrue(r[21]);

      // 👉 SOLO "En verificación"
      if (estadoPedido.toLowerCase() !== "en verificación") continue;

      // 👉 SOLO no revisados aún
      if (revisadoPlaneacion) continue;

      // Solo un registro por pedidoKey
      if (!map.has(pedidoKey)) {
        map.set(pedidoKey, {
          pedidoKey,
          consecutivo: toStr(r[0]),
          cliente: toStr(r[3]),
          oc: toStr(r[5]),
          fechaRequerida: toStr(r[15]),
          estadoPlaneacion: estadoPedido,
        });
      }
    }

    let items = Array.from(map.values());

    if (q) {
      const qq = q.toLowerCase();
      items = items.filter((i) =>
        i.pedidoKey.toLowerCase().includes(qq) ||
        i.consecutivo.toLowerCase().includes(qq) ||
        i.cliente.toLowerCase().includes(qq) ||
        i.oc.toLowerCase().includes(qq)
      );
    }

    items = items.reverse();

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[planeacion/pedidos/list]", error);
    return NextResponse.json(
      { success: false, message: "Error listando pedidos planeación" },
      { status: 500 }
    );
  }
}

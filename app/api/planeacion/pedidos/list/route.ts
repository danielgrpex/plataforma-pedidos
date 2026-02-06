// app/api/planeacion/pedidos/list/route.ts
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

/**
 * Google Sheets serial date:
 * - Días desde 1899-12-30 (equivalente Excel)
 */
function sheetsSerialToYMD(serial: number): string {
  // 25569 = días entre 1899-12-30 y 1970-01-01
  const ms = Math.round((serial - 25569) * 86400 * 1000);

  // ✅ Tomamos componentes en UTC para que no “baje” por timezone
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // ✅ sin zona horaria
}

function toYMDFromSheets(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return sheetsSerialToYMD(value);
  }

  const s = toStr(value);
  if (!s) return "";

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return sheetsSerialToYMD(n);
  }

  // Si ya viene en algo tipo "2026-01-10" lo dejamos
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Fallback: intentar parsear y devolver Y-M-D en UTC
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return s;
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
     * D  = 3  → Cliente
     * E  = 4  → Dirección y ciudad de despacho ✅ (NUEVO)
     * F  = 5  → OC
     * P  = 15 → Fecha Requerida Cliente
     * V  = 21 → Revisado Planeación
     * X  = 23 → Estado
     * AL = 37 → pedidoKey
     */
    const map = new Map<string, any>();

    for (const r of rows) {
      const pedidoKey = toStr(r[37]);
      if (!pedidoKey) continue;

      const estadoPedido = toStr(r[23]); // Estado general
      const revisadoPlaneacion = isTrue(r[21]);

      // SOLO "En verificación"
      if (estadoPedido.toLowerCase() !== "en verificación") continue;

      // SOLO no revisados aún
      if (revisadoPlaneacion) continue;

      // Solo un registro por pedidoKey
      if (!map.has(pedidoKey)) {
        map.set(pedidoKey, {
          pedidoKey,
          consecutivo: toStr(r[0]),
          cliente: toStr(r[3]),
          direccion: toStr(r[4]), // ✅ NUEVO: E
          oc: toStr(r[5]),
          // ✅ Fecha requerida sin desfase por TZ
          fechaRequerida: toYMDFromSheets(r[15]),
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
        i.direccion.toLowerCase().includes(qq) || // ✅ NUEVO
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

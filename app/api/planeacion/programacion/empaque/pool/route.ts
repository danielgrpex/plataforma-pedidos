//app/api/planeacion/programacion/empaque/pool/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type PoolItem = {
  tipo: "OPE" | "OTE";
  codigo: string;
  items: number;
  totalUND: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = toStr(searchParams.get("q") || "").toUpperCase();

    const sheets = await getSheetsClient();

    // 1) Leer SolicitudesProduccion!A:J (OPE y estado)
    // A solicitudProdId
    // B pedidoKey
    // C rowIndexPedido
    // D productoKey
    // E cantidadUND
    // F estado
    // ...
    // J OPE
    const prodResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:J",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const prodValues = (prodResp.data.values || []) as any[][];
    const prodRows = prodValues.length > 1 ? prodValues.slice(1) : [];

    // Agrupar por OPE cuando estado == "Producida"
    const mapOpe = new Map<string, { items: number; total: number }>();
    for (const r of prodRows) {
      const cantidadUND = toNum(r[4]); // E
      const estado = toStr(r[5]); // F
      const ope = toStr(r[9]); // J
      if (!ope) continue;
      if (estado !== "Producida") continue;

      const cur = mapOpe.get(ope) || { items: 0, total: 0 };
      cur.items += 1;
      cur.total += cantidadUND;
      mapOpe.set(ope, cur);
    }

    // 2) Leer SolicitudesCorte!A:P
    // M estadoitem (index 12)
    // E cantidadSolicitadaUnd (index 4)
    // P OTE (index 15)
    const corteResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesCorte!A:P",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const corteValues = (corteResp.data.values || []) as any[][];
    const corteRows = corteValues.length > 1 ? corteValues.slice(1) : [];

    // Agrupar por OTE cuando estadoitem == "Generada"
    const mapOte = new Map<string, { items: number; total: number }>();
    for (const r of corteRows) {
      const cantidadUND = toNum(r[4]); // E
      const estadoitem = toStr(r[12]); // M
      const ote = toStr(r[15]); // P
      if (!ote) continue;
      if (estadoitem !== "Generada") continue;

      const cur = mapOte.get(ote) || { items: 0, total: 0 };
      cur.items += 1;
      cur.total += cantidadUND;
      mapOte.set(ote, cur);
    }

    let items: PoolItem[] = [];

    for (const [codigo, v] of mapOpe.entries()) {
      items.push({ tipo: "OPE", codigo, items: v.items, totalUND: v.total });
    }
    for (const [codigo, v] of mapOte.entries()) {
      items.push({ tipo: "OTE", codigo, items: v.items, totalUND: v.total });
    }

    // filtro q
    if (q) {
      items = items.filter((x) => `${x.tipo}-${x.codigo}`.toUpperCase().includes(q) || x.codigo.toUpperCase().includes(q));
    }

    // ordenar: OPE primero, luego OTE; y por codigo
    items.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "OPE" ? -1 : 1;
      return a.codigo.localeCompare(b.codigo);
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[empaque/pool]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error cargando pool de empaque" },
      { status: 500 }
    );
  }
}

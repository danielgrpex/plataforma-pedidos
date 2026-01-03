import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const n = Number(String(v ?? "").toString().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type OpeResumen = {
  ope: string;
  items: number;
  totalUND: number;
  pedidos: number;
  ultimaActualizacion?: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = toStr(searchParams.get("q") || "");
    const estado = toStr(searchParams.get("estado") || "Programado"); // default Programado
    const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit") || 200)));

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length < 2) {
      return NextResponse.json({ success: true, items: [] });
    }

    const header = values[0].map((x) => toStr(x));
    const idx = (name: string) => header.findIndex((h) => h === name);

    const iPedidoKey = idx("pedidoKey");
    const iProductoKey = idx("productoKey");
    const iCantidadUND = idx("cantidadUND");
    const iEstado = idx("estado");
    const iUlt = idx("fechaUltActualizacion");
    const iOPE = idx("OPE");

    if (iEstado < 0 || iOPE < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No encontré columnas requeridas en SolicitudesProduccion. Revisa headers: estado y OPE.",
          header,
        },
        { status: 400 }
      );
    }

    const byOpe = new Map<string, { totalUND: number; items: number; pedidos: Set<string>; ult?: string }>();

    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];
      const rowEstado = toStr(row[iEstado]);
      const ope = toStr(row[iOPE]);

      if (!ope) continue;
      if (estado && rowEstado !== estado) continue;

      // filtro por q (OPE / pedidoKey / productoKey)
      if (q) {
        const pedidoKey = iPedidoKey >= 0 ? toStr(row[iPedidoKey]) : "";
        const productoKey = iProductoKey >= 0 ? toStr(row[iProductoKey]) : "";
        const hay = `${ope} ${pedidoKey} ${productoKey}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }

      const und = iCantidadUND >= 0 ? toNum(row[iCantidadUND]) : 0;
      const pedidoKey = iPedidoKey >= 0 ? toStr(row[iPedidoKey]) : "";
      const ult = iUlt >= 0 ? toStr(row[iUlt]) : "";

      const cur = byOpe.get(ope) || { totalUND: 0, items: 0, pedidos: new Set<string>(), ult: "" };

      cur.totalUND += und;
      cur.items += 1;
      if (pedidoKey) cur.pedidos.add(pedidoKey);

      // max “ultimaActualizacion” (comparación string ISO funciona bien)
      if (ult && (!cur.ult || ult > cur.ult)) cur.ult = ult;

      byOpe.set(ope, cur);
    }

    // ordenar: OPE260001, OPE260010 etc
    const toOpeNum = (ope: string) => {
      const m = ope.match(/OPE(\d+)/i);
      return m ? Number(m[1]) : 0;
    };

    const items: OpeResumen[] = Array.from(byOpe.entries())
      .map(([ope, v]) => ({
        ope,
        items: v.items,
        totalUND: v.totalUND,
        pedidos: v.pedidos.size,
        ultimaActualizacion: v.ult || "",
      }))
      .sort((a, b) => toOpeNum(b.ope) - toOpeNum(a.ope))
      .slice(0, limit);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[programacion/produccion/opes/list]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error listando OPEs" },
      { status: 500 }
    );
  }
}

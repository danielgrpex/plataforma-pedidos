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

// Lee SolicitudesProduccion (con headers)
async function readSolicitudes(sheets: any) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: "SolicitudesProduccion!A:J",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values: any[][] = resp.data.values || [];
  if (values.length < 2) return { header: [], rows: [] as any[] };

  const header = values[0].map((h) => toStr(h));
  const rows = values.slice(1).map((r, idx) => {
    const obj: Record<string, any> = {};
    header.forEach((h, i) => (obj[h] = r[i]));
    return {
      _rowNumber: idx + 2, // fila real en sheet
      ...obj,
    };
  });

  return { header, rows };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = toStr(searchParams.get("estado") || "Programado");
    const q = toStr(searchParams.get("q") || "").toUpperCase();

    const sheets = await getSheetsClient();
    const { rows } = await readSolicitudes(sheets);

    // Filtrar por estado + OPE
    const filtered = rows.filter((r) => {
      const ope = toStr(r["OPE"]);
      const est = toStr(r["estado"]);
      if (!ope) return false;
if (est.toLowerCase() !== estado.toLowerCase()) return false;


      if (!q) return true;
      const blob = `${ope} ${toStr(r["pedidoKey"])} ${toStr(r["productoKey"])}`.toUpperCase();
      return blob.includes(q);
    });

    // Agrupar por OPE
    const map = new Map<string, { ope: string; items: number; totalUND: number }>();
    for (const r of filtered) {
      const ope = toStr(r["OPE"]);
      const qty = toNum(r["cantidadUND"]);
      const cur = map.get(ope) || { ope, items: 0, totalUND: 0 };
      cur.items += 1;
      cur.totalUND += qty;
      map.set(ope, cur);
    }

    const items = Array.from(map.values()).sort((a, b) => (a.ope < b.ope ? 1 : -1));

    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error("[produccion/opes GET]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error listando OPEs" },
      { status: 500 }
    );
  }
}

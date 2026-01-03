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

function clienteFromPedidoKey(pedidoKey: string) {
  // ejemplo: "Algamar|Calle 54 # 46 - 15 | Itagui, Antioquia|27655"
  const s = toStr(pedidoKey);
  if (!s) return "";
  return s.split("|")[0]?.trim() || "";
}

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
      _rowNumber: idx + 2,
      ...obj,
    };
  });

  return { header, rows };
}

export async function GET(
  req: Request,
  ctx: { params: { ope: string } }
) {
  try {
    const ope = decodeURIComponent(ctx.params.ope || "");
    if (!ope) {
      return NextResponse.json({ success: false, message: "ope requerido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const { rows } = await readSolicitudes(sheets);

    const itemsRaw = rows.filter((r) => toStr(r["OPE"]) === ope);

    const items = itemsRaw.map((r) => ({
      solicitudProdId: toStr(r["solicitudProdId"]),
      pedidoKey: toStr(r["pedidoKey"]),
      rowIndexPedido: toNum(r["rowIndexPedido"]),
      productoKey: toStr(r["productoKey"]),
      cantidadUND: toNum(r["cantidadUND"]),
      cliente: clienteFromPedidoKey(toStr(r["pedidoKey"])),
      estado: toStr(r["estado"]),
    }));

    const totalUND = items.reduce((acc, it) => acc + toNum(it.cantidadUND), 0);
    const estado = items[0]?.estado || "";

    return NextResponse.json({
      success: true,
      detalle: {
        ope,
        estado,
        items,
        totalUND,
      },
    });
  } catch (e) {
    console.error("[produccion/opes/[ope] GET]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error cargando detalle OPE" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Linea = "Linea 1" | "Linea 2" | "Linea 3" | "Linea 4" | "Linea 5" | "Linea 6";
const LINEAS: Linea[] = ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5", "Linea 6"];

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function normKey(s: string) {
  return toStr(s).toLowerCase().replace(/\s+/g, "");
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();

    // 👇 OJO: el nombre de la pestaña según tu screenshot es "ColaProduccion"
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ColaProduccion!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length < 2) {
      const empty: Record<string, any[]> = {};
      LINEAS.forEach((l) => (empty[l] = []));
      return NextResponse.json({ success: true, lineas: empty, debug: { rows: values.length } });
    }

    // Leemos por headers (más robusto en deploy)
    const header = values[0].map((h) => normKey(h));
    const idxLinea = header.indexOf("linea");
    const idxOpe = header.indexOf("ope");
    const idxPos = header.indexOf("pos");
    const idxEstado = header.indexOf("estado");

    if (idxLinea < 0 || idxOpe < 0 || idxPos < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La hoja ColaProduccion no tiene las columnas requeridas (linea, ope, pos). Revisa encabezados.",
          debug: { headerRaw: values[0], headerNorm: header },
        },
        { status: 400 }
      );
    }

    const lineas: Record<string, { ope: string; pos: number; estado?: string }[]> = {};
    LINEAS.forEach((l) => (lineas[l] = []));

    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const linea = toStr(r[idxLinea]) as Linea;
      const ope = toStr(r[idxOpe]);
      const pos = Math.max(1, Math.floor(toNum(r[idxPos])));
      const estado = idxEstado >= 0 ? toStr(r[idxEstado]) : "";

      if (!ope) continue;
      if (!LINEAS.includes(linea)) continue;

      lineas[linea].push({ ope, pos, estado: estado || "En cola" });
    }

    // ordenar por pos
    for (const l of LINEAS) {
      lineas[l] = (lineas[l] || []).sort((a, b) => toNum(a.pos) - toNum(b.pos));
    }

    return NextResponse.json({
      success: true,
      lineas,
      debug: {
        totalRows: values.length - 1,
        counts: Object.fromEntries(LINEAS.map((l) => [l, lineas[l].length])),
      },
    });
  } catch (error) {
    console.error("[produccion/colas]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando colas",
      },
      { status: 500 }
    );
  }
}

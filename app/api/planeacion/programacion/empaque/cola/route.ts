//app/api/planeacion/programacion/empaque/cola/route.ts
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

type ColaItem = {
  empaqueItemId: string;
  tipo: "OPE" | "OTE";
  codigo: string;
  pos: number;
  estado: string;
  totalUND: number;
  items: number;
  fechaCreacion?: string;
  usuario?: string;
};

export async function GET() {
  try {
    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionEmpaque!A:I",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    const rows = values.length > 1 ? values.slice(1) : [];

    const list: ColaItem[] = rows
      .map((r) => ({
        empaqueItemId: toStr(r[0]),
        tipo: (toStr(r[1]) as "OPE" | "OTE") || "OPE",
        codigo: toStr(r[2]),
        pos: Math.max(1, Math.floor(toNum(r[3]))),
        estado: toStr(r[4]) || "En cola",
        totalUND: toNum(r[5]),
        items: Math.max(0, Math.floor(toNum(r[6]))),
        fechaCreacion: toStr(r[7]),
        usuario: toStr(r[8]),
      }))
      .filter((x) => x.empaqueItemId && x.codigo);

    list.sort((a, b) => a.pos - b.pos);

    return NextResponse.json({ success: true, items: list });
  } catch (error) {
    console.error("[empaque/cola]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error cargando cola de empaque" },
      { status: 500 }
    );
  }
}

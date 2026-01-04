//app/api/planeacion/programacion/produccion/colas/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Linea = "Linea 1" | "Linea 2" | "Linea 3" | "Linea 4" | "Linea 5" | "Linea 6";
const LINEAS: Linea[] = ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5", "Linea 6"];

type ColaItem = {
  id?: string;
  ope: string;
  pos: number;
  estado?: string;
  fechaCreacion?: string;
  fechaUltActualizacion?: string;
  usuario?: string;
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown) {
  // soporta 1, "1", "1.0", "1,0"
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normLinea(raw: unknown): Linea | "" {
  // ✅ Acepta:
  // - "Linea 1"
  // - "Línea 1"
  // - 1 / "1"
  const s = toStr(raw)
    .replace("Línea", "Linea")
    .replace(/\s+/g, " ");

  // Caso: ya viene "Linea X"
  if (LINEAS.includes(s as Linea)) return s as Linea;

  // Caso: viene solo número "1" .. "6"
  const n = toNum(s);
  if (n >= 1 && n <= 6) return `Linea ${n}` as Linea;

  return "";
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = toStr(h).toLowerCase();
    if (key) idx.set(key, i);
  });
  return idx;
}

function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ColaProduccion!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    const headerRow = values[0] || [];
    const dataRows = values.length > 1 ? values.slice(1) : [];

    const headerIdx = buildHeaderIndex(headerRow);

    const lineas: Record<string, ColaItem[]> = {};
    LINEAS.forEach((l) => (lineas[l] = []));

    for (const r of dataRows) {
      const linea = normLinea(pick(r, headerIdx, "linea"));
      const ope = toStr(pick(r, headerIdx, "ope"));

      // Si tu hoja no tiene "id", usamos fallback
      const id = toStr(pick(r, headerIdx, "id")) || `${linea}|${ope}`;

      if (!linea || !ope) continue;

      const pos = Math.max(1, Math.floor(toNum(pick(r, headerIdx, "pos")) || 1));
      const estado = toStr(pick(r, headerIdx, "estado")) || "En cola";
      const fechaCreacion = toStr(pick(r, headerIdx, "fechacreacion"));
      const fechaUltActualizacion = toStr(pick(r, headerIdx, "fechaultactualizacion"));
      const usuario = toStr(pick(r, headerIdx, "usuario"));

      lineas[linea].push({
        id,
        ope,
        pos,
        estado,
        fechaCreacion,
        fechaUltActualizacion,
        usuario,
      });
    }

    LINEAS.forEach((l) => {
      lineas[l] = (lineas[l] || []).sort((a, b) => (a.pos || 0) - (b.pos || 0));
    });

    const counts: Record<string, number> = {};
    LINEAS.forEach((l) => (counts[l] = (lineas[l] || []).length));

    return NextResponse.json({
      success: true,
      lineas,
      debug: {
        rowsLeidas: dataRows.length,
        headerRaw: headerRow,
        headerNorm: headerRow.map((x) => toStr(x).toLowerCase()),
        counts,
      },
    });
  } catch (e) {
    console.error("[produccion/colas]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error leyendo colas" },
      { status: 500 }
    );
  }
}

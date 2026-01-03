import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

type Linea = "Linea 1" | "Linea 2" | "Linea 3" | "Linea 4" | "Linea 5" | "Linea 6";
const LINEAS: Linea[] = ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5", "Linea 6"];

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function ensureSheet(sheets: any, title: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    fields: "sheets(properties(sheetId,title))",
  });

  const exists = (meta.data.sheets || []).some((s: any) => s?.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  // header
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${title}!A1:F1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "linea",         // A
        "pos",           // B
        "ope",           // C
        "estado",        // D
        "fechaCreacion", // E
        "usuario",       // F
      ]],
    },
  });
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const SHEET = "ColaProduccion";

    await ensureSheet(sheets, SHEET);

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `${SHEET}!A2:F`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows: any[][] = resp.data.values || [];

    const lineas: Record<string, any[]> = {};
    for (const l of LINEAS) lineas[l] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const linea = toStr(r[0]) as Linea;
      const pos = toNum(r[1]);
      const ope = toStr(r[2]);
      const estado = toStr(r[3]) || "En cola";

      if (!LINEAS.includes(linea)) continue;
      if (!ope) continue;
      if (pos <= 0) continue;

      lineas[linea].push({
        ope,
        pos,
        estado,
      });
    }

    // ordenar por pos
    for (const l of LINEAS) {
      lineas[l].sort((a, b) => (a.pos || 0) - (b.pos || 0));
    }

    return NextResponse.json({ success: true, lineas });
  } catch (e) {
    console.error("[colas GET]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error leyendo colas" },
      { status: 500 }
    );
  }
}

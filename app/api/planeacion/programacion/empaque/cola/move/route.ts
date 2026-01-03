//app/api/planeacion/programacion/empaque/cola/move/route.ts
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

type Body = {
  codigo: string;
  dir: "up" | "down";
  tipo?: "OPE" | "OTE";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const codigo = toStr(body.codigo);
    const dir = body.dir;
    const tipo = toStr(body.tipo) as "OPE" | "OTE" | "";

    if (!codigo) return NextResponse.json({ success: false, message: "codigo requerido" }, { status: 400 });
    if (dir !== "up" && dir !== "down") {
      return NextResponse.json({ success: false, message: "dir inválido (up/down)" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionEmpaque!A:I",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    const rows = values.length > 1 ? values.slice(1) : [];

    // Construimos lista con sheetRow
    const list = rows
      .map((r, i) => ({
        sheetRow: i + 2,
        empaqueItemId: toStr(r[0]),
        tipo: toStr(r[1]) as "OPE" | "OTE",
        codigo: toStr(r[2]),
        pos: Math.max(1, Math.floor(toNum(r[3]))),
      }))
      .filter((x) => x.empaqueItemId && x.codigo);

    list.sort((a, b) => a.pos - b.pos);

    const idx = list.findIndex((x) => x.codigo === codigo && (!tipo || x.tipo === tipo));
    if (idx < 0) {
      return NextResponse.json({ success: false, message: "No encontrado en ProgramacionEmpaque" }, { status: 404 });
    }

    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) {
      return NextResponse.json({ success: true, message: "Sin cambios (límite)" });
    }

    // Swap en memoria
    const a = list[idx];
    const b = list[swapWith];
    const tmp = a.pos;
    a.pos = b.pos;
    b.pos = tmp;

    // Renumerar 1..n para evitar huecos y mantener consistencia
    const normalized = [...list].sort((x, y) => x.pos - y.pos).map((x, i) => ({ ...x, pos: i + 1 }));

    const data = normalized.map((x) => ({
      range: `ProgramacionEmpaque!D${x.sheetRow}:D${x.sheetRow}`,
      values: [[String(x.pos)]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[empaque/cola/move]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error moviendo prioridad" },
      { status: 500 }
    );
  }
}

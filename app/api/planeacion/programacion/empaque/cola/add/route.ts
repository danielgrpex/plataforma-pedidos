//app/api/planeacion/programacion/empaque/cola/add/route.ts
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
function makeId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
}

type Body = {
  tipo: "OPE" | "OTE";
  codigo: string;
  totalUND?: number;
  items?: number;
  usuario?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const tipo = toStr(body.tipo) as "OPE" | "OTE";
    const codigo = toStr(body.codigo);
    const usuario = toStr(body.usuario) || "planeacion";

    if (!tipo || (tipo !== "OPE" && tipo !== "OTE")) {
      return NextResponse.json({ success: false, message: "tipo inválido (OPE/OTE)" }, { status: 400 });
    }
    if (!codigo) {
      return NextResponse.json({ success: false, message: "codigo requerido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    // Leer cola actual para:
    // - evitar duplicados
    // - calcular pos final
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionEmpaque!A:I",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    const rows = values.length > 1 ? values.slice(1) : [];

    let maxPos = 0;
    for (const r of rows) {
      const t = toStr(r[1]);
      const c = toStr(r[2]);
      const p = toNum(r[3]);

      if (t === tipo && c === codigo) {
        return NextResponse.json(
          { success: false, message: `${tipo} ${codigo} ya está en ProgramacionEmpaque.` },
          { status: 400 }
        );
      }
      if (p > maxPos) maxPos = p;
    }

    const ts = new Date().toISOString();
    const nextPos = Math.floor(maxPos) + 1;

    const empaqueItemId = makeId("EMPAQUE");
    const totalUND = toNum(body.totalUND);
    const items = Math.max(0, Math.floor(toNum(body.items)));

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionEmpaque!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            empaqueItemId, // A
            tipo, // B
            codigo, // C
            String(nextPos), // D
            "En cola", // E
            String(totalUND || ""), // F
            String(items || ""), // G
            ts, // H
            usuario, // I
          ],
        ],
      },
    });

    return NextResponse.json({ success: true, empaqueItemId, pos: nextPos });
  } catch (error) {
    console.error("[empaque/cola/add]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error agregando a cola de empaque" },
      { status: 500 }
    );
  }
}

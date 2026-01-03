//app/api/planeacion/programacion/empaque/estado/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

type Body = {
  codigo: string;
  tipo?: "OPE" | "OTE";
  estado: "En cola" | "En empaque" | "Empacado";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const codigo = toStr(body.codigo);
    const tipo = toStr(body.tipo) as "OPE" | "OTE" | "";
    const estado = toStr(body.estado) as Body["estado"];

    if (!codigo) return NextResponse.json({ success: false, message: "codigo requerido" }, { status: 400 });
    if (!estado) return NextResponse.json({ success: false, message: "estado requerido" }, { status: 400 });

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionEmpaque!A:I",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    const rows = values.length > 1 ? values.slice(1) : [];

    const list = rows
      .map((r, i) => ({
        sheetRow: i + 2,
        tipo: toStr(r[1]) as "OPE" | "OTE",
        codigo: toStr(r[2]),
        estado: toStr(r[4]),
      }))
      .filter((x) => x.codigo);

    const target = list.find((x) => x.codigo === codigo && (!tipo || x.tipo === tipo));
    if (!target) {
      return NextResponse.json({ success: false, message: "No encontrado en ProgramacionEmpaque" }, { status: 404 });
    }

    const updates: Array<{ range: string; values: any[][] }> = [];

    // Si ponemos "En empaque", forzamos que cualquier otro "En empaque" pase a "En cola"
    if (estado === "En empaque") {
      for (const x of list) {
        if (x.estado === "En empaque" && !(x.codigo === target.codigo && x.tipo === target.tipo)) {
          updates.push({
            range: `ProgramacionEmpaque!E${x.sheetRow}:E${x.sheetRow}`,
            values: [["En cola"]],
          });
        }
      }
    }

    // Set estado al target
    updates.push({
      range: `ProgramacionEmpaque!E${target.sheetRow}:E${target.sheetRow}`,
      values: [[estado]],
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[empaque/estado]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error actualizando estado" },
      { status: 500 }
    );
  }
}

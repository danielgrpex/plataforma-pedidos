//app/api/planeacion/programacion/corte/programar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}

type Body = {
  solicitudCorteIds: string[];
  usuario?: string;
};

function currentYY() {
  const yy = new Date().getFullYear() % 100;
  return String(yy).padStart(2, "0");
}

function parseOteNum(ote: string) {
  // OTE260001 -> 1
  const m = ote.match(/^OTE(\d{2})(\d{4})$/i);
  if (!m) return null;
  return { yy: m[1], num: Number(m[2]) };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const usuario = toStr(body.usuario) || "planeacion";
    const ids = Array.isArray(body.solicitudCorteIds)
      ? body.solicitudCorteIds.map(toStr).filter(Boolean)
      : [];

    if (!ids.length) {
      return NextResponse.json({ success: false, message: "solicitudCorteIds requerido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    // 1) Leer toda la hoja para:
    //    - mapear solicitudCorteId -> sheetRow
    //    - encontrar último OTE del año actual
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesCorte!A:P",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: false, message: "SolicitudesCorte está vacía" }, { status: 400 });
    }

    const rows = values.slice(1);

    const idToSheetRow = new Map<string, number>(); // sheetRow (1-based real)
    let maxNumThisYY = 0;
    const yy = currentYY();

    rows.forEach((r, i) => {
      const sheetRow = i + 2; // porque quitamos encabezado
      const solId = toStr(r[0]); // A
      const ote = toStr(r[15]); // P

      if (solId) idToSheetRow.set(solId, sheetRow);

      const parsed = parseOteNum(ote);
      if (parsed && parsed.yy === yy) {
        if (parsed.num > maxNumThisYY) maxNumThisYY = parsed.num;
      }
    });

    // 2) Validar que existen en la hoja
    const missing = ids.filter((id) => !idToSheetRow.has(id));
    if (missing.length) {
      return NextResponse.json(
        { success: false, message: `No existen en hoja: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}` },
        { status: 400 }
      );
    }

    // 3) Crear el nuevo OTE (uno solo para el grupo seleccionado)
    const nextNum = maxNumThisYY + 1;
    const ote = `OTE${yy}${String(nextNum).padStart(4, "0")}`;

    // 4) Actualizar filas (M, O, P)
    //    Si una fila ya tiene OTE, la respetamos (no la tocamos)
    const updateData: Array<{ range: string; values: any[][] }> = [];
    let updated = 0;
    let skippedHasOte = 0;

    for (const id of ids) {
      const sheetRow = idToSheetRow.get(id)!;
      const rowArr = values[sheetRow - 1] || []; // ojo: values incluye encabezado
      const existingOte = toStr(rowArr[15]); // P

      if (existingOte) {
        skippedHasOte += 1;
        continue;
      }

      updateData.push(
        { range: `SolicitudesCorte!M${sheetRow}:M${sheetRow}`, values: [["Programado"]] }, // M
        { range: `SolicitudesCorte!O${sheetRow}:O${sheetRow}`, values: [[usuario]] }, // O
        { range: `SolicitudesCorte!P${sheetRow}:P${sheetRow}`, values: [[ote]] } // P
      );
      updated += 1;
    }

    if (!updateData.length) {
      return NextResponse.json({
        success: false,
        message: "No se actualizó nada (probablemente ya tenían OTE).",
        ote,
        skippedHasOte,
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updateData },
    });

    return NextResponse.json({
      success: true,
      ote,
      updated,
      skippedHasOte,
    });
  } catch (error) {
    console.error("[corte/programar]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error programando OTE" },
      { status: 500 }
    );
  }
}

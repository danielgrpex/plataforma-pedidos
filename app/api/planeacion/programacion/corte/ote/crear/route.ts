//app/api/planeacion/programacion/corte/ote/crear/route.ts
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
function pad6(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(6, "0");
}

type Body = {
  solicitudCorteIds: string[];
  usuario?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const solicitudCorteIds = Array.isArray(body.solicitudCorteIds)
      ? body.solicitudCorteIds.map(toStr).filter(Boolean)
      : [];

    if (!solicitudCorteIds.length) {
      return NextResponse.json(
        { success: false, message: "solicitudCorteIds requerido" },
        { status: 400 }
      );
    }

    const usuario = toStr(body.usuario) || "planeacion";
    const ts = new Date().toISOString();

    const sheets = await getSheetsClient();

    // 1) Leer toda la hoja para:
    //    - encontrar las filas de esas solicitudes
    //    - obtener el mayor consecutivo de OTE existente
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesCorte!A:P",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json(
        { success: false, message: "SolicitudesCorte está vacía" },
        { status: 400 }
      );
    }

    const header = values[0];
    const rows = values.slice(1);

    // 2) Buscar max OTE existente (formato OTEyyNNNNNN)
    const yy = String(new Date().getFullYear()).slice(2);
    let maxSeq = 0;

    for (const r of rows) {
      const ote = toStr(r[15]); // P
      const m = ote.match(/^OTE(\d{2})(\d{6})$/i);
      if (!m) continue;
      const year = m[1];
      const seq = Number(m[2]);
      if (year === yy && Number.isFinite(seq)) {
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1;
    const newOTE = `OTE${yy}${pad6(nextSeq)}`;

    // 3) Indexar solicitudes -> sheetRow
    // sheetRow real en Sheets = index + 2 (por header)
    const idSet = new Set(solicitudCorteIds);

    const updates: Array<{ range: string; values: any[][] }> = [];
    const notFound: string[] = [];
    const skippedWithOTE: string[] = [];

    rows.forEach((r, i) => {
      const solicitudCorteId = toStr(r[0]); // A
      if (!solicitudCorteId) return;
      if (!idSet.has(solicitudCorteId)) return;

      const sheetRow = i + 2;
      const existingOTE = toStr(r[15]); // P
      const estadoitem = toStr(r[12]); // M

      // Si ya tiene OTE, lo saltamos (no dañamos la programación)
      if (existingOTE) {
        skippedWithOTE.push(solicitudCorteId);
        return;
      }

      // P OTE
      updates.push({
        range: `SolicitudesCorte!P${sheetRow}:P${sheetRow}`,
        values: [[newOTE]],
      });

      // M estadoitem -> Programado
      updates.push({
        range: `SolicitudesCorte!M${sheetRow}:M${sheetRow}`,
        values: [["Programado"]],
      });

      // O usuario (última act)
      updates.push({
        range: `SolicitudesCorte!O${sheetRow}:O${sheetRow}`,
        values: [[usuario]],
      });

      // (Opcional) N fechaCreacion no se toca (es creación)
      // Si luego haces "fechaUltActualizacion", ahí sí guardamos ts
      void estadoitem;
    });

    // Si el usuario mandó IDs que no existen
    // (comparamos cuántos realmente procesamos o saltamos)
    const foundOrSkipped = new Set<string>([...skippedWithOTE]);
    rows.forEach((r) => {
      const id = toStr(r[0]);
      if (id && idSet.has(id)) foundOrSkipped.add(id);
    });
    solicitudCorteIds.forEach((id) => {
      if (!foundOrSkipped.has(id)) notFound.push(id);
    });

    if (!updates.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No se pudo asignar OTE. Puede que todas las solicitudes ya tengan OTE.",
          skippedWithOTE,
          notFound,
        },
        { status: 400 }
      );
    }

    // 4) Aplicar batchUpdate
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });

    return NextResponse.json({
      success: true,
      ote: newOTE,
      updatedCells: updates.length,
      skippedWithOTE,
      notFound,
      ts,
    });
  } catch (error) {
    console.error("[planeacion/programacion/corte/ote/crear]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error creando OTE",
      },
      { status: 500 }
    );
  }
}

// app/api/planeacion/programacion/ope/crear/route.ts
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

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = norm(h);
    if (key) idx.set(key, i);
  });
  return idx;
}

function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}

type Body = {
  solicitudProdIds: string[];
  usuario?: string;
};

function currentYY() {
  const y = new Date().getFullYear();
  return String(y).slice(-2); // "26"
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function parseOPE(ope: string) {
  // OPE260001 => yy=26 seq=0001
  const m = String(ope || "").trim().match(/^OPE(\d{2})(\d{4})$/i);
  if (!m) return null;
  return { yy: m[1], seq: Number(m[2]) || 0 };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const usuario = toStr(body.usuario) || "planeacion";
    const solicitudProdIds = Array.isArray(body.solicitudProdIds)
      ? body.solicitudProdIds.map(toStr).filter(Boolean)
      : [];

    if (!solicitudProdIds.length) {
      return NextResponse.json(
        { success: false, message: "solicitudProdIds requerido (array)" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesProduccion!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json(
        { success: false, message: "No hay datos en SolicitudesProduccion" },
        { status: 404 }
      );
    }

    const header = values[0];
    const idx = buildHeaderIndex(header);
    const rows = values.slice(1);

    // headers mínimos
    const required = ["solicitudprodid", "estado", "ope"];
    const missing = required.filter((h) => !idx.has(h));
    if (missing.length) {
      return NextResponse.json(
        {
          success: false,
          message: `Faltan columnas en SolicitudesProduccion: ${missing.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 1) Calcular siguiente OPE del año actual
    const yy = currentYY();
    let maxSeq = 0;

    for (const r of rows) {
      const ope = toStr(pick(r, idx, "OPE"));
      const parsed = parseOPE(ope);
      if (!parsed) continue;
      if (parsed.yy !== yy) continue;
      if (parsed.seq > maxSeq) maxSeq = parsed.seq;
    }

    const nextSeq = maxSeq + 1;
    const opeNew = `OPE${yy}${pad4(nextSeq)}`;

    // 2) Construir mapa solicitudProdId -> rowIndex1Based en sheet
    // sheet row = (index en rows) + 2
    const rowById = new Map<string, number>();
    rows.forEach((r, i) => {
      const id = toStr(pick(r, idx, "solicitudProdId"));
      if (id) rowById.set(id, i + 2);
    });

    const now = new Date().toISOString();
    const estadoNuevo = "Programado";

    const data: Array<{ range: string; values: any[][] }> = [];
    const debug: Array<{ solicitudProdId: string; ok: boolean; reason?: string }> = [];

    for (const id of solicitudProdIds) {
      const row = rowById.get(id);
      if (!row) {
        debug.push({ solicitudProdId: id, ok: false, reason: "No existe en hoja" });
        continue;
      }

      // Actualizamos columnas específicas (sin tocar fechaCreacion)
      // F estado, H fechaUltActualizacion, I usuario, J OPE
      data.push({ range: `SolicitudesProduccion!F${row}:F${row}`, values: [[estadoNuevo]] });
      data.push({ range: `SolicitudesProduccion!H${row}:H${row}`, values: [[now]] });
      data.push({ range: `SolicitudesProduccion!I${row}:I${row}`, values: [[usuario]] });
      data.push({ range: `SolicitudesProduccion!J${row}:J${row}`, values: [[opeNew]] });

      debug.push({ solicitudProdId: id, ok: true });
    }

    if (!data.length) {
      return NextResponse.json(
        {
          success: false,
          message: "No se actualizó ninguna fila. Revisa solicitudProdIds.",
          debug,
        },
        { status: 400 }
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });

    return NextResponse.json({
      success: true,
      ope: opeNew,
      updatedItems: debug.filter((d) => d.ok).length,
      debug,
    });
  } catch (error) {
    console.error("[planeacion/programacion/ope/crear]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error creando OPE",
      },
      { status: 500 }
    );
  }
}


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
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}
function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const k = norm(h);
    if (k) idx.set(k, i);
  });
  return idx;
}
function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}

// ====== TIPOS ======
type EstadoProg = "En cola" | "En proceso" | "Producida" | "Cancelada";
type Linea = 1 | 2 | 3 | 4 | 5 | 6;

type ProgRow = {
  progId: string;
  ope: string;
  linea: Linea;
  posicion: number;
  estado: EstadoProg;
  fechaCreacion: string;
  fechaUltActualizacion: string;
  usuario: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function readProgramacion(sheets: any) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: "ProgramacionProduccion!A:Z",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = (resp.data.values || []) as any[][];
  if (values.length <= 1) return { header: [], idx: new Map<string, number>(), rows: [] as any[][] };

  const header = values[0];
  const idx = buildHeaderIndex(header);
  const rows = values.slice(1);
  return { header, idx, rows };
}

export async function GET(req: Request) {
  try {
    const sheets = await getSheetsClient();
    const { rows, idx } = await readProgramacion(sheets);

    const items: ProgRow[] = [];

    rows.forEach((r, i) => {
      const progId = toStr(pick(r, idx, "progId"));
      const ope = toStr(pick(r, idx, "ope"));
      const linea = toNum(pick(r, idx, "linea")) as Linea;
      const posicion = toNum(pick(r, idx, "posicion"));
      const estado = (toStr(pick(r, idx, "estado")) as EstadoProg) || "En cola";
      const fechaCreacion = toStr(pick(r, idx, "fechaCreacion"));
      const fechaUltActualizacion = toStr(pick(r, idx, "fechaUltActualizacion"));
      const usuario = toStr(pick(r, idx, "usuario"));

      if (!ope || !linea) return;

      // ✅ solo mostrar cola activa
      if (estado === "Producida" || estado === "Cancelada") return;

      items.push({
        progId: progId || String(i + 2), // fallback
        ope,
        linea,
        posicion,
        estado,
        fechaCreacion,
        fechaUltActualizacion,
        usuario,
      });
    });

    // ordenar por linea + posicion
    items.sort((a, b) => a.linea - b.linea || a.posicion - b.posicion);

    // agrupar por linea
    const lineas: Record<string, ProgRow[]> = {};
    for (const it of items) {
      const k = String(it.linea);
      lineas[k] = lineas[k] || [];
      lineas[k].push(it);
    }

    return NextResponse.json({ success: true, lineas });
  } catch (e) {
    console.error("[produccion/programacion][GET]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error listando programación" },
      { status: 500 }
    );
  }
}

type PostBody = { ope: string; linea: Linea; usuario?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    const ope = toStr(body.ope);
    const linea = Number(body.linea) as Linea;
    const usuario = toStr(body.usuario) || "planeacion";
    if (!ope) return NextResponse.json({ success: false, message: "ope requerido" }, { status: 400 });
    if (![1, 2, 3, 4, 5, 6].includes(linea)) {
      return NextResponse.json({ success: false, message: "linea inválida (1-6)" }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const ts = nowIso();

    // calcular siguiente posicion para esa linea
    const { rows, idx } = await readProgramacion(sheets);

    let maxPos = 0;
    rows.forEach((r) => {
      const l = toNum(pick(r, idx, "linea"));
      const st = toStr(pick(r, idx, "estado"));
      const pos = toNum(pick(r, idx, "posicion"));
      if (l === linea && st !== "Producida" && st !== "Cancelada") {
        if (pos > maxPos) maxPos = pos;
      }
    });

    const nextPos = maxPos + 1;

    // ✅ append
    const rowToAppend = [
      "", // progId (vacío, usamos rowNumber si no hay)
      ope,
      linea,
      nextPos,
      "En cola",
      ts,
      ts,
      usuario,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionProduccion!A:H",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowToAppend] },
    });

    return NextResponse.json({ success: true, ope, linea, posicion: nextPos });
  } catch (e) {
    console.error("[produccion/programacion][POST]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error programando OPE" },
      { status: 500 }
    );
  }
}

type PatchBody = { progId: string; estado: EstadoProg; usuario?: string };

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as PatchBody;
    const progId = toStr(body.progId);
    const estado = toStr(body.estado) as EstadoProg;
    const usuario = toStr(body.usuario) || "produccion";
    if (!progId) return NextResponse.json({ success: false, message: "progId requerido" }, { status: 400 });
    if (!["En cola", "En proceso", "Producida", "Cancelada"].includes(estado)) {
      return NextResponse.json({ success: false, message: "estado inválido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const ts = nowIso();

    // leer hoja completa para encontrar fila
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ProgramacionProduccion!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: false, message: "No hay datos en ProgramacionProduccion" }, { status: 400 });
    }

    const header = values[0];
    const idx = buildHeaderIndex(header);

    // buscar rowIndex 1-based (en Sheets)
    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      const idCell = toStr(pick(r, idx, "progId"));
      const fallbackId = String(i + 1); // si progId viene vacío, lo usamos como rowNumber
      if (idCell === progId || fallbackId === progId) {
        foundRow = i + 1; // 1-based
        break;
      }
    }

    if (!foundRow) {
      return NextResponse.json({ success: false, message: "progId no encontrado" }, { status: 404 });
    }

    // columnas: estado (E), fechaUltActualizacion (G), usuario (H)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `ProgramacionProduccion!E${foundRow}:E${foundRow}`, values: [[estado]] },
          { range: `ProgramacionProduccion!G${foundRow}:G${foundRow}`, values: [[ts]] },
          { range: `ProgramacionProduccion!H${foundRow}:H${foundRow}`, values: [[usuario]] },
        ],
      },
    });

    return NextResponse.json({ success: true, progId, estado });
  } catch (e) {
    console.error("[produccion/programacion][PATCH]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Error actualizando estado" },
      { status: 500 }
    );
  }
}

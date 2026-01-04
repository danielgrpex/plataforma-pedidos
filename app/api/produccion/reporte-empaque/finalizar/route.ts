//app/api/produccion/reporte-empaque/finalizar/route.ts
import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

function nowBogotaHora() {
  const d = new Date();
  return d.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHeaders(values: any[][]) {
  return (values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

function applyUpdates(headers: string[], row: any[], updates: Record<string, any>) {
  const out = [...row];
  const map = new Map(headers.map((h, i) => [h, i]));

  for (const [k, v] of Object.entries(updates)) {
    const idx = map.get(k);
    if (idx === undefined) continue;
    out[idx] = v ?? "";
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rowIndex, data } = body ?? {};

    if (!rowIndex || !data) {
      return NextResponse.json({ error: "Faltan datos: rowIndex, data" }, { status: 400 });
    }

    // 1) headers
    const headerValues = await getBasePrincipalRange("ReporteOperarioEq!1:1");
    const headers = getHeaders(headerValues);
    if (!headers.length) {
      return NextResponse.json({ error: "No se pudieron leer headers" }, { status: 500 });
    }

    // 2) leer fila
    const rowValues = await getBasePrincipalRange(`ReporteOperarioEq!A${rowIndex}:Z${rowIndex}`);
    const row = rowValues?.[0] ?? [];
    if (!row.length) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    // 3) validar en curso
    const estadoCol = headers.indexOf("Estado");
    const estActual = estadoCol >= 0 ? String(row[estadoCol] ?? "").trim() : "";
    if (estActual !== "En curso") {
      return NextResponse.json(
        { error: `La orden ya no está En curso (Estado actual: ${estActual})` },
        { status: 409 }
      );
    }

    const horaFin = nowBogotaHora();

    // actividades: array -> "a, b, c"
    const actividadesArr: string[] = Array.isArray(data.actividades) ? data.actividades : [];
    const actividadStr = actividadesArr.map((x) => String(x).trim()).filter(Boolean).join(", ");

    const updates: Record<string, any> = {
      "Hora Fin": horaFin,
      "Estado": "Finalizado",
      "Avance": data.avance ?? "",
      "PNC (UND)": data.pncUnd ?? "",
      "PNC (Kg)": data.pncKg ?? "",
      "Observaciones Empaque": String(data.observacionesEmpaque ?? ""),
      "Supervisor": String(data.supervisor ?? ""),
      "Actividad": actividadStr, // 👈 aquí guardamos las selecciones separadas por coma
    };

    const updatedRow = applyUpdates(headers, row, updates);

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `ReporteOperarioEq!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [updatedRow] },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[POST finalizar empaque]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

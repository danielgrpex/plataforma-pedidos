import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

function rowsToObjects(values: any[][]) {
  if (!values?.length) return [];
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  return values.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = row?.[i] ?? ""));
    return obj;
  });
}

function nowBogota() {
  const d = new Date();
  const timestamp = d.toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const hora = d.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { timestamp, hora };
}

async function getHeadersReporteEq() {
  const headerRow = await getBasePrincipalRange("ReporteOperarioEq!1:1");
  return (headerRow?.[0] ?? []).map((h: any) => String(h ?? "").trim());
}

function makeRowByHeaders(headers: string[], data: Record<string, any>) {
  const row = new Array(headers.length).fill("");
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h in data) row[i] = data[h] ?? "";
  }
  return row;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitudCorteId, trabajadorNombre } = body ?? {};

    if (!solicitudCorteId || !trabajadorNombre) {
      return NextResponse.json(
        { error: "Faltan datos: solicitudCorteId, trabajadorNombre" },
        { status: 400 }
      );
    }

    // 1) Buscar la orden en SolicitudesCorte
    const values = await getBasePrincipalRange("SolicitudesCorte!A:Z");
    const rows = rowsToObjects(values);

    const item = rows.find(
      (r) => String(r.solicitudCorteId ?? "").trim() === String(solicitudCorteId).trim()
    );

    if (!item) return NextResponse.json({ error: "SolicitudCorte no encontrada" }, { status: 404 });

    const OTE = String(item.OTE ?? "").trim();
    const rowIndexPedido = item.rowIndexPedido ?? "";
    const productoSolicitado = String(item.productoSolicitado ?? "").trim();

    if (!OTE || !productoSolicitado) {
      return NextResponse.json({ error: "La orden no tiene OTE o productoSolicitado" }, { status: 400 });
    }

    // 2) Preparar fila para ReporteOperarioEq
    const { timestamp, hora } = nowBogota();

    const headers = await getHeadersReporteEq();
    if (!headers.length) {
      return NextResponse.json({ error: "No se pudieron leer headers de ReporteOperarioEq" }, { status: 500 });
    }

    const dataRow: Record<string, any> = {
      Timestamp: timestamp,
      OTE,
      rowIndexPedido,
      productoSolicitado,
      Trabajador: trabajadorNombre,
      "Hora Inicio": hora,
      Actividad: "Inicio Empaque",
      Estado: "En curso",
    };

    const row = makeRowByHeaders(headers, dataRow);

    // 3) Append
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "ReporteOperarioEq!A:Z",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[POST iniciar empaque]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

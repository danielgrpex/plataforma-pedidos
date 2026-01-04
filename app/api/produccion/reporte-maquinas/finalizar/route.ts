//app/api/produccion/reporte-maquinas/finalizar/route.ts
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

function rowsWithHeaders(values: any[][]) {
  const headers = (values?.[0] ?? []).map((h) => String(h ?? "").trim());
  return headers;
}

function applyUpdatesToRow(headers: string[], row: any[], updates: Record<string, any>) {
  const out = [...row];
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  for (const [k, v] of Object.entries(updates)) {
    const idx = headerIndex.get(k);
    if (idx === undefined) continue; // si la columna no existe, la ignoramos
    out[idx] = v ?? "";
  }
  return out;
}

function mapTipo(tipo: string) {
  if (tipo === "alistamiento") {
    return { actividad: "Alistamiento Herramental", estado: "En alistamiento" };
  }
  if (tipo === "cuadre") {
    return { actividad: "Cuadre de linea", estado: "En Cuadre de linea" };
  }
  return { actividad: "Inicio de producción", estado: "En Producción" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { tipo, rowIndex, data } = body ?? {};
    if (!tipo || !rowIndex || !data) {
      return NextResponse.json(
        { error: "Faltan datos: tipo, rowIndex, data" },
        { status: 400 }
      );
    }

    if (!["alistamiento", "cuadre", "produccion"].includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const { actividad, estado } = mapTipo(tipo);

    // 1) Leer headers
    const headerValues = await getBasePrincipalRange("ReporteOperarioMq!1:1");
    const headers = rowsWithHeaders(headerValues);
    if (!headers.length) {
      return NextResponse.json({ error: "No se pudieron leer headers" }, { status: 500 });
    }

    // 2) Leer la fila exacta
    const rowValues = await getBasePrincipalRange(`ReporteOperarioMq!A${rowIndex}:AZ${rowIndex}`);
    const row = rowValues?.[0] ?? [];
    if (!row.length) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    // 3) Validar que aún esté en curso (actividad + estado)
    const actividadCol = headers.indexOf("Actividad");
    const estadoCol = headers.indexOf("Estado");
    const actActual = actividadCol >= 0 ? String(row[actividadCol] ?? "").trim() : "";
    const estActual = estadoCol >= 0 ? String(row[estadoCol] ?? "").trim() : "";

    if (actActual !== actividad || estActual !== estado) {
      return NextResponse.json(
        { error: `La orden ya no está en curso para esta pestaña. (Actividad/Estado actual: ${actActual} / ${estActual})` },
        { status: 409 }
      );
    }

    // 4) Armar updates según tipo
    const horaFin = nowBogotaHora();

    const updatesBase: Record<string, any> = {
      "Hora Fin": horaFin,
      "Estado": "Finalizado",
    };

    let updates: Record<string, any> = { ...updatesBase };

    if (tipo === "alistamiento") {
      updates["Observaciones Alistamiento"] = String(data.observacionesAlistamiento ?? "");
    }

    if (tipo === "cuadre") {
      updates = {
        ...updatesBase,
        "PNC Cuadre (Kg)": data.pncCuadreKg ?? "",
        "TZ1MQ1": data.tz1mq1 ?? "",
        "TZ2MQ1": data.tz2mq1 ?? "",
        "TZ3MQ1": data.tz3mq1 ?? "",
        "TCZMQ1": data.tczmq1 ?? "",
        "TBQMQ1": data.tbqmq1 ?? "",
        "FREMQ1": data.fremq1 ?? "",

        "TZ1MQ2": data.tz1mq2 ?? "",
        "TZ2MQ2": data.tz2mq2 ?? "",
        "TZ3MQ2": data.tz3mq2 ?? "",
        "TCZMQ2": data.tczmq2 ?? "",
        "TBQMQ2": data.tbqmq2 ?? "",
        "FREMQ2": data.fremq2 ?? "",

        "TZ1MQ3": data.tz1mq3 ?? "",
        "TZ2MQ3": data.tz2mq3 ?? "",
        "TZ3MQ3": data.tz3mq3 ?? "",
        "TCZMQ3": data.tczmq3 ?? "",
        "TBQMQ3": data.tbqmq3 ?? "",
        "FREMQ3": data.fremq3 ?? "",

        "FREHAL": data.frehal ?? "",
        "Observaciones Cuadre": String(data.observacionesCuadre ?? ""),
      };
    }

    if (tipo === "produccion") {
      // Nota: el sheet no listaba "Observaciones Producción".
      // Si existe en headers, se llena; si no, se ignora.
      updates = {
        ...updatesBase,
        "Avance": data.avance ?? "",
        "Peso Real": data.pesoReal ?? "",
        "Ciclo Real": data.cicloReal ?? "",
        "PNC (UND)": data.pncUnd ?? "",
        "PNC (Kg)": data.pncKg ?? "",
        "Tiempo Paro (h)": data.tiempoParoH ?? "",
        "Tipo Paro": String(data.tipoParo ?? ""),
        "Supervisor": String(data.supervisor ?? ""),
        "Observaciones Producción": String(data.observacionesProduccion ?? ""),
      };
    }

    // 5) Aplicar updates a la fila y guardar
    const updatedRow = applyUpdatesToRow(headers, row, updates);

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `ReporteOperarioMq!A${rowIndex}:AZ${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [updatedRow] },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[POST finalizar reporte maquinas]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

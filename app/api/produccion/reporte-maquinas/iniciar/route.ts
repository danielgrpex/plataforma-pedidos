//app/api/produccion/reporte-maquinas/iniciar/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange, getSheetsClient } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

/** Convierte matriz (values) a objetos por headers */
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

/**
 * Lee headers reales de ReporteOperarioMq para ubicar columnas por nombre
 */
async function getReporteHeaders() {
  const headerRow = await getBasePrincipalRange("ReporteOperarioMq!1:1");
  const headers = (headerRow?.[0] ?? []).map((h: any) => String(h ?? "").trim());
  return headers;
}

function makeRowByHeaders(headers: string[], data: Record<string, any>) {
  // Creamos fila con el largo exacto de headers
  const row = new Array(headers.length).fill("");

  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (key in data) row[i] = data[key];
  }

  return row;
}

async function appendReporteOperarioMq(row: any[]) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: "ReporteOperarioMq!A:AZ",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      tipo, // "alistamiento" | "cuadre" | "inicio"
      solicitudProdId,
      trabajadorNombre, // 👈 importante: el sheet guarda nombre
      herramentalNombre,
      maquina1Nombre,
      maquina2Nombre,
      maquina3Nombre,
      haladorNombre,
    } = body ?? {};

    if (!tipo || !solicitudProdId || !trabajadorNombre) {
      return NextResponse.json(
        { error: "Faltan datos: tipo, solicitudProdId, trabajadorNombre" },
        { status: 400 }
      );
    }

    // 1) Buscar solicitud en SolicitudesProduccion
    const values = await getBasePrincipalRange("SolicitudesProduccion!A:Z");
    const rows = rowsToObjects(values);

    const solicitud = rows.find(
      (r) => String(r.solicitudProdId ?? "").trim() === String(solicitudProdId).trim()
    );

    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const OPE = String(solicitud.OPE ?? "").trim();
    const productoKey = String(solicitud.productoKey ?? "").trim();

    if (!OPE || !productoKey) {
      return NextResponse.json(
        { error: "La solicitud no tiene OPE o productoKey" },
        { status: 400 }
      );
    }

    // 2) Preparar datos según tipo
    const { timestamp, hora } = nowBogota();

    let estado = "";
    let actividad = "";

    if (tipo === "alistamiento") {
      estado = "En alistamiento";
      actividad = "Alistamiento Herramental";
      if (!herramentalNombre) {
        return NextResponse.json({ error: "Falta herramentalNombre" }, { status: 400 });
      }
    } else if (tipo === "cuadre") {
      estado = "En Cuadre de linea";
      actividad = "Cuadre de linea";
      if (!maquina1Nombre || !maquina2Nombre || !maquina3Nombre || !haladorNombre) {
        return NextResponse.json(
          { error: "Faltan máquinas/halador (maquina1Nombre, maquina2Nombre, maquina3Nombre, haladorNombre)" },
          { status: 400 }
        );
      }
    } else if (tipo === "inicio") {
      estado = "En Producción";
      actividad = "Inicio de producción";
    } else {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    // 3) Armar fila por headers reales del sheet
    const headers = await getReporteHeaders();
    if (!headers.length) {
      return NextResponse.json(
        { error: "No se pudieron leer headers de ReporteOperarioMq" },
        { status: 500 }
      );
    }

    const baseData: Record<string, any> = {
      Timestamp: timestamp,
      OPE,
      productoKey,
      Trabajador: trabajadorNombre,
      "Hora Inicio": hora,
      Actividad: actividad,
      Estado: estado,
    };

    if (tipo === "alistamiento") {
      baseData["Herramental"] = herramentalNombre;
    }

    if (tipo === "cuadre") {
      baseData["Maquina 1"] = maquina1Nombre;
      baseData["Maquina 2"] = maquina2Nombre;
      baseData["Maquina 3"] = maquina3Nombre;
      baseData["Halador"] = haladorNombre;
    }

    const row = makeRowByHeaders(headers, baseData);

    // 4) Append
    await appendReporteOperarioMq(row);

    return NextResponse.json(
      { ok: true, escrito: { OPE, productoKey, trabajadorNombre, estado, actividad } },
      { status: 200 }
    );
  } catch (e) {
    console.error("[POST iniciar reporte maquinas]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

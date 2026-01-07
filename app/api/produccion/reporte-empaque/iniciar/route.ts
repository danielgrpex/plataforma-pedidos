//app/api/produccion/reporte-empaque/iniciar/route.ts
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
    const { tipo, solicitudId, trabajadorNombre } = body ?? {};

    if (!tipo || !solicitudId || !trabajadorNombre) {
      return NextResponse.json(
        { error: "Faltan datos: tipo, solicitudId, trabajadorNombre" },
        { status: 400 }
      );
    }
    if (!["corte", "produccion"].includes(String(tipo))) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const headers = await getHeadersReporteEq();
    if (!headers.length) {
      return NextResponse.json({ error: "No se pudieron leer headers de ReporteOperarioEq" }, { status: 500 });
    }

    const headersLower = headers.map((h) => h.toLowerCase());
    const hasOPE = headersLower.includes("ope");
    const hasOTE = headersLower.includes("ote");

    let code = "";
    let rowIndexPedido: any = "";
    let producto: string = "";

    if (tipo === "corte") {
      const values = await getBasePrincipalRange("SolicitudesCorte!A:Z");
      const rows = rowsToObjects(values);

      const item = rows.find(
        (r) => String(r.solicitudCorteId ?? "").trim() === String(solicitudId).trim()
      );

      if (!item) return NextResponse.json({ error: "SolicitudCorte no encontrada" }, { status: 404 });

      code = String(item.OTE ?? "").trim();
      rowIndexPedido = item.rowIndexPedido ?? "";
      producto = String(item.productoSolicitado ?? "").trim();

      if (!code || !producto) {
        return NextResponse.json({ error: "La orden no tiene OTE o productoSolicitado" }, { status: 400 });
      }
    } else {
      const values = await getBasePrincipalRange("SolicitudesProduccion!A:Z");
      const rows = rowsToObjects(values);

      const item = rows.find(
        (r) => String(r.solicitudProdId ?? "").trim() === String(solicitudId).trim()
      );

      if (!item) return NextResponse.json({ error: "SolicitudProduccion no encontrada" }, { status: 404 });

      code = String(item.OPE ?? "").trim();
      rowIndexPedido = item.rowIndexPedido ?? "";
      producto = String(item.productoKey ?? "").trim();

      if (!code || !producto) {
        return NextResponse.json({ error: "La orden no tiene OPE o productoKey" }, { status: 400 });
      }
    }

    const { timestamp, hora } = nowBogota();

    const dataRow: Record<string, any> = {
      Timestamp: timestamp,
      rowIndexPedido,
      productoSolicitado: producto, // lo usamos como “producto” genérico (sirve para OTE y OPE)
      Trabajador: trabajadorNombre,
      "Hora Inicio": hora,
      Actividad: "Inicio Empaque",
      Estado: "En curso",
      Tipo: tipo === "corte" ? "Corte" : "Producción",
    };

    // poner código en la columna correcta si existe
    if (tipo === "corte") {
      if (hasOTE) dataRow["OTE"] = code;
      else if (hasOPE) dataRow["OPE"] = ""; // nada
      else dataRow["OTE"] = code; // fallback
    } else {
      if (hasOPE) dataRow["OPE"] = code;
      else if (hasOTE) dataRow["OTE"] = code; // fallback para no perder el OPE
      else dataRow["OTE"] = code;
    }

    const row = makeRowByHeaders(headers, dataRow);

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

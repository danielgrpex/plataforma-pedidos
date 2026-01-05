// app/api/planeacion/pedido/validacion/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Columnas en Pedidos (según tu lista):
 * T = Observaciones Planeación
 * U = Revisado Planeación
 * V = Fecha Revisión Planeación
 * W = Estado Planeación
 * X = Estado
 *
 * pedidoKey está en la col 38 (0-based 37) según tu código actual.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const pedidoKey = toStr(body?.pedidoKey);
    const decision = toStr(body?.decision); // "aprobar" | "rechazar"
    const observaciones = toStr(body?.observaciones);

    if (!pedidoKey) {
      return NextResponse.json({ success: false, message: "pedidoKey es requerido" }, { status: 400 });
    }
    if (decision !== "aprobar" && decision !== "rechazar") {
      return NextResponse.json({ success: false, message: "decision inválida" }, { status: 400 });
    }
    if (!observaciones) {
      return NextResponse.json({ success: false, message: "observaciones es requerido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    // Leer Pedidos
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (pedResp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: false, message: "No hay datos en Pedidos" }, { status: 404 });
    }

    const rows = values.slice(1);

    // Encontrar TODAS las filas del pedido (porque un pedido ocupa varias filas)
    const matches: Array<{ rowIndex1Based: number; row: any[] }> = [];
    rows.forEach((r, i) => {
      if (toStr(r[37]) === pedidoKey) {
        matches.push({ rowIndex1Based: i + 2, row: r });
      }
    });

    if (!matches.length) {
      return NextResponse.json({ success: false, message: "Pedido no encontrado" }, { status: 404 });
    }

    const fecha = todayYMD();

    const estadoPlaneacion = decision === "aprobar" ? "Validado" : "Rechazado";
    const estado =
      decision === "aprobar"
        ? toStr(matches[0].row[23]) || "En verificación" // no tocamos el estado general si aprueba
        : "Rechazado - Comercial";

    // Actualizar columnas T..X para cada fila del pedido
    // T=Obs, U=Revisado, V=Fecha, W=EstadoPlaneacion, X=Estado
    const data = matches.map((m) => ({
      range: `Pedidos!T${m.rowIndex1Based}:X${m.rowIndex1Based}`,
      values: [[observaciones, "SI", fecha, estadoPlaneacion, estado]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[planeacion/pedido/validacion]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error guardando validación" },
      { status: 500 }
    );
  }
}

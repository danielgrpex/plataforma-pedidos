//app/api/planeacion/programacion/corte/pendientes/route.ts
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

type CorteRow = {
  solicitudCorteId: string; // A
  pedidoKey: string; // B
  rowIndexPedido: number; // C
  productoSolicitado: string; // D
  cantidadSolicitadaUnd: number; // E
  inventarioOrigenId: string; // F
  productoOrigen: string; // G
  largoOrigen: string; // H
  cantidadOrigenUnd: number; // I
  largoFinal: string; // J
  actividades: string; // K
  cantidadResultanteUnd: string; // L (aún texto por ahora)
  estadoitem: string; // M
  fechaCreacion: string; // N
  usuario: string; // O
  ote: string; // P
};

export async function GET() {
  try {
    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "SolicitudesCorte!A:P",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: true, items: [] });
    }

    const rows = values.slice(1);

    const items: CorteRow[] = rows
      .map((r) => {
        const solicitudCorteId = toStr(r[0]);
        return {
          solicitudCorteId,
          pedidoKey: toStr(r[1]),
          rowIndexPedido: Number(r[2] ?? 0),
          productoSolicitado: toStr(r[3]),
          cantidadSolicitadaUnd: Number(r[4] ?? 0),
          inventarioOrigenId: toStr(r[5]),
          productoOrigen: toStr(r[6]),
          largoOrigen: toStr(r[7]),
          cantidadOrigenUnd: Number(r[8] ?? 0),
          largoFinal: toStr(r[9]),
          actividades: toStr(r[10]),
          cantidadResultanteUnd: toStr(r[11]),
          estadoitem: toStr(r[12]),
          fechaCreacion: toStr(r[13]),
          usuario: toStr(r[14]),
          ote: toStr(r[15]),
        };
      })
      .filter((x) => x.solicitudCorteId && norm(x.estadoitem) === "pendiente");

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[corte/pendientes]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error cargando pendientes" },
      { status: 500 }
    );
  }
}

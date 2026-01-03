//app/api/planeacion/programacion/corte/solicitudes/route.ts
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const estado = toStr(searchParams.get("estado") || "Pendiente"); // estadoitem
    const q = norm(searchParams.get("q") || "");

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

    // header + rows
    const rows = values.slice(1);

    const items = rows
      .map((r) => {
        const solicitudCorteId = toStr(r[0]); // A
        if (!solicitudCorteId) return null;

        const item = {
          solicitudCorteId, // A
          pedidoKey: toStr(r[1]), // B
          rowIndexPedido: toStr(r[2]), // C
          productoSolicitado: toStr(r[3]), // D
          cantidadSolicitadaUnd: toStr(r[4]), // E
          inventarioOrigenId: toStr(r[5]), // F
          productoOrigen: toStr(r[6]), // G
          largoOrigen: toStr(r[7]), // H
          cantidadOrigenUnd: toStr(r[8]), // I
          largoFinal: toStr(r[9]), // J
          actividades: toStr(r[10]), // K
          cantidadResultanteUnd: toStr(r[11]), // L
          estadoitem: toStr(r[12]), // M
          fechaCreacion: toStr(r[13]), // N
          usuario: toStr(r[14]), // O
          OTE: toStr(r[15]), // P
        };

        return item;
      })
      .filter(Boolean) as any[];

    // filtro por estadoitem
    const filteredByEstado = items.filter((it) => {
      if (!estado) return true;
      return toStr(it.estadoitem) === estado;
    });

    // filtro por q (simple contains)
    const filtered = !q
      ? filteredByEstado
      : filteredByEstado.filter((it) => {
          const haystack = [
            it.solicitudCorteId,
            it.pedidoKey,
            it.rowIndexPedido,
            it.productoSolicitado,
            it.inventarioOrigenId,
            it.productoOrigen,
            it.largoOrigen,
            it.estadoitem,
            it.OTE,
            it.usuario,
          ]
            .map((x) => norm(x))
            .join(" | ");
          return haystack.includes(q);
        });

    return NextResponse.json({
      success: true,
      items: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("[planeacion/programacion/corte/solicitudes]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error listando solicitudes de corte",
      },
      { status: 500 }
    );
  }
}

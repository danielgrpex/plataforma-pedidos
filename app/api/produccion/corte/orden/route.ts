import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ordenCorteId = toStr(searchParams.get("ordenCorteId"));
    if (!ordenCorteId) {
      return NextResponse.json({ success: false, message: "ordenCorteId requerido" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    // Cabecera
    const ocResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "OrdenCorte!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const ocValues = (ocResp.data.values || []) as any[][];
    const ocRows = ocValues.length > 1 ? ocValues.slice(1) : [];
    const head = ocRows.find((r) => toStr(r?.[0]) === ordenCorteId);

    if (!head) {
      return NextResponse.json({ success: false, message: "Orden no encontrada" }, { status: 404 });
    }

    // Items
    const itResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "OrdenCorte_Items!A:Q",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const itValues = (itResp.data.values || []) as any[][];
    const itRows = itValues.length > 1 ? itValues.slice(1) : [];
    const items = itRows
      .filter((r) => toStr(r?.[1]) === ordenCorteId) // B = ordenCorteId
      .map((r) => ({
        ordenCorteItemId: toStr(r?.[0]),
        pedidoKey: toStr(r?.[2]),
        pedidoRowIndex: Number(r?.[3] || 0),
        productoSolicitado: toStr(r?.[4]),
        cantidadSolicitadaUnd: toStr(r?.[5]),
        destinoFinal: toStr(r?.[6]),
        estadoItem: toStr(r?.[7]),
      }));

    const orden = {
      ordenCorteId: toStr(head?.[0]),
      fechaCreacion: toStr(head?.[1]),
      estado: toStr(head?.[2]),
      responsable: toStr(head?.[3]),
      observaciones: toStr(head?.[4]),
      totalItems: Number(head?.[5] || items.length),
      creadoPor: toStr(head?.[6]),
      fechaCierre: toStr(head?.[7]),
      items,
    };

    return NextResponse.json({ success: true, orden });
  } catch (error) {
    console.error("[produccion/corte/orden]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error cargando orden" },
      { status: 500 }
    );
  }
}

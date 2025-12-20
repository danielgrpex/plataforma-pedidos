// app/api/planeacion/pedido/route.ts
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
    const pedidoKey = toStr(searchParams.get("pedidoKey"));
    if (!pedidoKey) {
      return NextResponse.json(
        { success: false, message: "pedidoKey es requerido" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json(
        { success: false, message: "No hay datos en Pedidos" },
        { status: 404 }
      );
    }

    // Importante: aquí NO usamos fetch por producto (para no reventar cuota)
    // Asumimos que ya tienes bulk funcionando en /api/inventario/disponible/bulk
    const rowsAll = values.slice(1);
    const rows = rowsAll.filter((r) => toStr(r[37]) === pedidoKey); // AL
    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const first = rows[0];

    // Armamos items incluyendo rowIndex real (1-based en Sheets)
    const itemsBase = rows.map((r, idx) => {
      const producto = toStr(r[6]); // G
      const productoKeyItem = toStr(r[6]); // ⚠️ fallback (ideal: columna propia)
      const rowIndex1Based = rowsAll.findIndex((x) => x === r) + 2; // +2 por encabezado y 1-based

      return {
        rowIndex1Based,
        productoKey: productoKeyItem,
        producto,
        cantidadUnd: toStr(r[11]), // L
        cantidadM: toStr(r[12]), // M
        // Destino planeación por fila (si lo usas)
        clasificacionPlaneacionItem: toStr(r[19]), // T
      };
    });

    // ✅ Bulk inventario disponible (evita cuota)
    const baseUrl = new URL(req.url);
    baseUrl.pathname = "/api/inventario/disponible/bulk";

    const uniqueKeys = Array.from(
      new Set(itemsBase.map((it) => it.productoKey).filter(Boolean))
    );

    let invByKey: Record<string, { und: number; m: number }> = {};
    if (uniqueKeys.length) {
      const invRes = await fetch(baseUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ productoKeys: uniqueKeys }),
      });
      const invJson = await invRes.json();
      invByKey = (invJson?.byKey || {}) as Record<string, { und: number; m: number }>;
    }

    const pedido = {
      pedidoKey,
      consecutivo: toStr(first[0]),
      fechaSolicitud: toStr(first[1]),
      asesor: toStr(first[2]),
      cliente: toStr(first[3]),
      direccion: toStr(first[4]),
      oc: toStr(first[5]),
      fechaRequerida: toStr(first[15]),

      // ✅ Para botón PDF en Planeación
      pdfPath: toStr(first[35]), // AJ

      // Estado general pedido (si quieres mostrarlo)
      estado: toStr(first[23]), // X (según tu hoja actual)

      // Planeación header (si lo tienes)
      clasificacionPlaneacion: toStr(first[19]), // T
      observacionesPlaneacion: toStr(first[20]), // U
      revisadoPlaneacion: toStr(first[21]), // V
      fechaRevisionPlaneacion: toStr(first[22]), // W
      estadoPlaneacion: toStr(first[23]), // X

      items: itemsBase.map((it) => ({
        rowIndex1Based: it.rowIndex1Based,
        productoKey: it.productoKey,
        producto: it.producto,
        cantidadUnd: it.cantidadUnd,
        cantidadM: it.cantidadM,
        inventarioDisponibleUnd: Number(invByKey[it.productoKey]?.und ?? 0),
        inventarioDisponibleM: Number(invByKey[it.productoKey]?.m ?? 0),
        destinoSugerido: it.clasificacionPlaneacionItem || "", // opcional
      })),
    };

    return NextResponse.json({ success: true, pedido });
  } catch (error) {
    console.error("[planeacion/pedido]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Error cargando pedido planeación",
      },
      { status: 500 }
    );
  }
}

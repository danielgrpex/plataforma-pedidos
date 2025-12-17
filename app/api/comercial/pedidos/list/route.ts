import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

type PedidoListItem = {
  consecutivo: string;
  fechaSolicitud: string;
  asesor: string;
  cliente: string;
  oc: string;
  estado: string;
  pdfPath: string;
  createdBy: string;
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000); // tope 1000
    const q = toStr(searchParams.get("q") || "");
    const estado = toStr(searchParams.get("estado") || "");

    const sheets = await getSheetsClient();

    // Leemos todo (simple y robusto). Si crece mucho, luego optimizamos.
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AK",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = (resp.data.values || []) as any[][];
    if (values.length <= 1) {
      return NextResponse.json({ success: true, items: [] });
    }

    // Si la fila 1 es header, la saltamos:
    const rows = values.slice(1);

    // Mapeo por posición (A=0 ... AK=36)
    let items: PedidoListItem[] = rows.map((r) => {
      const consecutivo = toStr(r[0]);
      const fechaSolicitud = toStr(r[1]);
      const asesor = toStr(r[2]);
      const cliente = toStr(r[3]);
      const oc = toStr(r[5]);          // col 6
      const estadoRow = toStr(r[23]);  // col 24
      const pdfPath = toStr(r[35]);    // col 36 (AJ)
      const createdBy = toStr(r[36]);  // col 37 (AK)

      return {
        consecutivo,
        fechaSolicitud,
        asesor,
        cliente,
        oc,
        estado: estadoRow,
        pdfPath,
        createdBy,
      };
    });

    // Filtros (backend) — opcional pero útil
    if (estado) {
      items = items.filter((i) => i.estado.toLowerCase() === estado.toLowerCase());
    }

    if (q) {
      const qq = q.toLowerCase();
      items = items.filter((i) => {
        return (
          i.consecutivo.toLowerCase().includes(qq) ||
          i.cliente.toLowerCase().includes(qq) ||
          i.oc.toLowerCase().includes(qq) ||
          i.asesor.toLowerCase().includes(qq)
        );
      });
    }

    // Orden: últimos primero (asumiendo append al final)
    items = items.reverse().slice(0, limit);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[pedidos/list]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error listando pedidos" },
      { status: 500 }
    );
  }
}

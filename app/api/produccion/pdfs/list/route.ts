//app/api/produccion/pdfs/list/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Luego lo conectamos a Sheets
  return NextResponse.json({
    success: true,
    items: [
      {
        tipo: "OPE",
        codigo: "OPE260001",
        cliente: "Algarra",
        producto: "Enganche Bisagra 4cm",
        cantidad: 200,
        estado: "En cola",
      },
      {
        tipo: "OTE",
        codigo: "OTE2600001",
        cliente: "Invercomer",
        producto: "Enganche Blanco 4cm",
        cantidad: 200,
        estado: "Programada",
      },
    ],
  });
}

// app/api/comercial/catalogos/route.ts
import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

async function getSimpleList(range: string) {
  const values = await getInfoSheetRange(range);
  return values.map((r) => r[0]).filter(Boolean);
}

export async function GET() {
  try {
    const [
      clientes,
      referencias,
      colores,
      anchos,
      acabados,
      vendedores,
    ] = await Promise.all([
      getSimpleList("Clientes!A2:A"),
      getSimpleList("Referencias!A2:A"),
      getSimpleList("Color!A2:A"),
      getSimpleList("Ancho!A2:A"),
      getSimpleList("Acabados!A2:A"),
      getSimpleList("Vendedores!A2:A"),
    ]);

    return NextResponse.json({
      clientes,
      referencias,
      colores,
      anchos,
      acabados,
      vendedores,
    });
  } catch (error) {
    console.error("Error en /api/comercial/catalogos", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los catálogos" },
      { status: 500 }
    );
  }
}

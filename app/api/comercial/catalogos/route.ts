// app/api/comercial/catalogos/route.ts
import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

// 🚫 Evitar cualquier tipo de caché
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSimpleList(range: string) {
  const values = await getInfoSheetRange(range);
  return (values || []).map((r) => r?.[0]).filter(Boolean);
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

    return NextResponse.json(
      {
        clientes,
        referencias,
        colores,
        anchos,
        acabados,
        vendedores,
      },
      {
        headers: {
          // 🔥 claves para que Vercel / navegador NO cacheen
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Error en /api/comercial/catalogos", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los catálogos" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

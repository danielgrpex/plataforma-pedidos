// app/api/comercial/catalogos/clientes/route.ts
import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/googleSheets";

export const runtime = "nodejs"; // nos aseguramos de no usar edge

export async function GET() {
  try {
    const values = await getInfoSheetRange("Clientes!A2:A");

    const clientes = values
      .map((row) => row[0])
      .filter((v) => !!v);

    return NextResponse.json({ clientes });
  } catch (error) {
    console.error("Error leyendo clientes desde Google Sheets:", error);
    return NextResponse.json(
      { error: "No se pudo leer la lista de clientes" },
      { status: 500 }
    );
  }
}

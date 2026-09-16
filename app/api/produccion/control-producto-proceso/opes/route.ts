import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function rowsWithIndex(values: any[][]) {
  if (!values?.length) {
    return {
      headers: [],
      rows: [] as Record<string, any>[],
    };
  }

  const headers = (values[0] ?? []).map((h) =>
    String(h ?? "").trim()
  );

  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = {
      sheetRow: i + 2,
    };

    headers.forEach((h, idx) => {
      const v = row?.[idx] ?? "";

      obj[h] = v;
      obj[h.toLowerCase()] = v;
    });

    return obj;
  });

  return { headers, rows };
}

function toNumber(value: any) {
  const n = Number(
    String(value ?? "")
      .trim()
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return Number.isFinite(n) ? n : 0;
}

function norm(value: any) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET() {
  try {
    const values = await getBasePrincipalRange(
      "SolicitudesProduccion!A:J"
    );

    const { rows } = rowsWithIndex(values);

    const generadas = rows
      .filter((r) => norm(r.estado) === "generada")
      .filter((r) => String(r.OPE ?? r.ope ?? "").trim() !== "")
      .map((r) => ({
        sheetRow: r.sheetRow,

        solicitudProdId: String(
          r.solicitudProdId ??
            r.solicitudprodid ??
            ""
        ).trim(),

        pedidoKey: String(
          r.pedidoKey ??
            r.pedidokey ??
            ""
        ).trim(),

        rowIndexPedido:
          r.rowIndexPedido ??
          r.rowindexpedido ??
          "",

        producto: String(
          r.productoKey ??
            r.productokey ??
            ""
        ).trim(),

        cantidadProgramadaUnd: toNumber(
          r.cantidadUND ??
            r.cantidadund
        ),

        estado: String(r.estado ?? "").trim(),

        OPE: String(
          r.OPE ??
            r.ope ??
            ""
        ).trim(),
      }));

    /*
     * Agrupamos por OPE porque una OPE puede tener
     * varios productos/medidas.
     */
    const opeMap = new Map<
      string,
      {
        OPE: string;
        cantidadItems: number;
        items: typeof generadas;
      }
    >();

    for (const item of generadas) {
      const actual = opeMap.get(item.OPE);

      if (!actual) {
        opeMap.set(item.OPE, {
          OPE: item.OPE,
          cantidadItems: 1,
          items: [item],
        });

        continue;
      }

      actual.items.push(item);
      actual.cantidadItems = actual.items.length;
    }

    const opes = Array.from(opeMap.values()).sort((a, b) =>
      b.OPE.localeCompare(a.OPE, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

    return NextResponse.json(
      {
        ok: true,
        totalOPE: opes.length,
        totalItems: generadas.length,
        opes,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, max-age=0, s-maxage=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET control producto proceso - OPE]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible leer las OPE disponibles.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

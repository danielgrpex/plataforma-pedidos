import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const SHEET_ID = process.env.SHEET_SOLICITUDES_SOPLADO_ID!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_BUCKET = process.env.SUPABASE_PDF_BUCKET!;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

type Payload = {
  cabecera: {
    tipo?: string;
    cliente: string;
    direccion: string;
    oc: string;
    fechaRequerida: string;
    asesor: string;
    obs?: string;
    fechaSolicitud?: string;
    created_by?: string;
  };
  items: Array<{
    siigo: string;
    referencia: string;
    materialColor: string;
    boca: string;
    volumen: string;
    cantidad: string;
    precioUnitario?: string;
    acabados: string[];
  }>;
  pdfPath: string;
};

function formatDateToDDMMYYYY(value?: string) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

function splitSiigo(value: string) {
  const raw = String(value || "").trim();
  const parts = raw.split(" - ");

  if (parts.length >= 2) {
    const codigoSiigo = parts.shift()?.trim() || "";
    const nombreSiigo = parts.join(" - ").trim();
    return { codigoSiigo, nombreSiigo };
  }

  return {
    codigoSiigo: raw,
    nombreSiigo: "",
  };
}

function splitMaterialColor(value: string) {
  const raw = String(value || "").trim();
  const parts = raw.split(" - ");

  if (parts.length >= 2) {
    const material = parts.shift()?.trim() || "";
    const color = parts.join(" - ").trim();
    return { material, color };
  }

  return {
    material: raw,
    color: "",
  };
}

function buildPublicPdfUrl(pdfPath: string) {
  const cleanBase = SUPABASE_URL.replace(/\/+$/, "");
  const cleanBucket = SUPABASE_BUCKET.replace(/^\/+|\/+$/g, "");
  const cleanPath = String(pdfPath || "").replace(/^\/+/, "");

  return `${cleanBase}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
}

async function getNextConsecutiveStart(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Soplado!A2:A",
  });

  const rows = response.data.values || [];
  const nums = rows
    .map((r: any[]) => Number(r?.[0]))
    .filter((n: number) => Number.isFinite(n));

  if (!nums.length) return 1;
  return Math.max(...nums) + 1;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;

    if (!body?.cabecera) {
      return NextResponse.json(
        { success: false, message: "Falta la cabecera del pedido." },
        { status: 400 }
      );
    }

    if (!body?.items?.length) {
      return NextResponse.json(
        { success: false, message: "Debes enviar al menos un producto." },
        { status: 400 }
      );
    }

    if (!body?.pdfPath) {
      return NextResponse.json(
        { success: false, message: "Falta el pdfPath del pedido." },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({
      version: "v4",
      auth: client as any,
    });

    const nextStart = await getNextConsecutiveStart(sheets);

    const fechaSolicitud = formatDateToDDMMYYYY(
      body.cabecera.fechaSolicitud || new Date().toISOString()
    );
    const fechaRequerida = formatDateToDDMMYYYY(body.cabecera.fechaRequerida);
    const ordenUrl = buildPublicPdfUrl(body.pdfPath);

    const rows = body.items.map((item, index) => {
      const consecutivo = nextStart + index;

      const { codigoSiigo, nombreSiigo } = splitSiigo(item.siigo);
      const { material, color } = splitMaterialColor(item.materialColor);

      const producto = nombreSiigo || item.referencia || "";

      return [
        consecutivo, // A Consecutivo
        fechaSolicitud, // B Fecha de Solicitud
        body.cabecera.cliente?.trim() || "", // C Cliente
        body.cabecera.oc?.trim() || "", // D # OC/Pedido/Cot.
        codigoSiigo, // E Código Siigo
        nombreSiigo, // F Nombre Siigo
        producto, // G Producto
        item.referencia?.trim() || "", // H Referencia
        item.volumen?.trim() || "", // I Volumen
        material, // J Material
        color, // K Color
        item.boca?.trim() || "", // L Boca
        (item.acabados || []).join(", "), // M Acabados
        item.cantidad?.trim() || "", // N Cantidad
        item.precioUnitario?.trim() || "", // O Precio unitario
        body.cabecera.obs?.trim() || "", // P Observaciones
        fechaRequerida, // Q Fecha Requerida Cliente
        body.cabecera.asesor?.trim() || "", // R Vendedor
        ordenUrl, // S Orden Url
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Soplado!A:S",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pedido soplado guardado correctamente.",
      data: {
        rowsCreated: rows.length,
        firstConsecutive: nextStart,
        lastConsecutive: nextStart + rows.length - 1,
        ordenUrl,
      },
    });
  } catch (error: any) {
    console.error("Error guardando pedido soplado:", error);
    console.error("Error message:", error?.message);
    console.error("Error response data:", error?.response?.data);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Error interno al guardar pedido soplado.",
      },
      { status: 500 }
    );
  }
}
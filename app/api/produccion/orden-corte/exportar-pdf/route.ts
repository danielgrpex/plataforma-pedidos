// app/api/produccion/orden-corte/exportar-pdf/route.ts
// app/api/produccion/orden-corte/exportar-pdf/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportItem = {
  consecutivo: number | string;
  cliente: string;
  oc: string;
  ordenProduccion?: string;
  productoInicial: string;
  cantidadInicial: number | string;
  actividades: string;
  codigoSiggoFinal?: string;
  productoFinal: string;
  cantidadFinal: number | string;
};

type Body = {
  numeroOrden: string;
  version: number;
  creadoPor: string;
  observaciones?: string;
  items: ExportItem[];
  pdfPath?: string; // donde guardar en Supabase Storage
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function formatDateTimeCO(d = new Date()) {
  // similar a lo que ya estás viendo en el PDF
  return d.toLocaleString("es-CO");
}

async function getSheetIdByTitle(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const found = (meta.data.sheets || []).find((s: any) => s?.properties?.title === title);
  return found?.properties?.sheetId as number | undefined;
}

async function duplicateSheet(
  sheets: any,
  spreadsheetId: string,
  sourceSheetId: number,
  newSheetName: string
) {
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId,
            newSheetName,
          },
        },
      ],
    },
  });

  const reply = res.data.replies?.[0]?.duplicateSheet;
  const newSheetId = reply?.properties?.sheetId;
  if (!newSheetId) throw new Error("No pude duplicar la hoja PlantillaCorte");
  return newSheetId as number;
}

async function deleteSheet(sheets: any, spreadsheetId: string, sheetId: number) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteSheet: { sheetId } }],
    },
  });
}

async function batchWriteValues(
  sheets: any,
  spreadsheetId: string,
  data: { range: string; values: any[][] }[]
) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

/**
 * OJO:
 * - Para exportar PDF desde Google, usamos el endpoint /export?format=pdf&gid=...
 * - Necesitamos un access token del auth del cliente de google.
 */
async function getAccessTokenFromSheetsClient(sheets: any) {
  const auth =
    (sheets as any)?._options?.auth ??
    (sheets as any)?.context?._options?.auth ??
    (sheets as any)?._options?.authClient;

  if (!auth || typeof auth.getAccessToken !== "function") {
    throw new Error("No pude obtener auth client para exportar PDF");
  }

  const tok = await auth.getAccessToken();
  const token = typeof tok === "string" ? tok : tok?.token;
  if (!token) throw new Error("No pude obtener access token para exportar PDF");
  return token;
}

export async function POST(req: Request) {
  let stage = "start";
  let tempSheetId: number | null = null;
  let tempSheetName = "";

  try {
    stage = "read-body";
    const body = (await req.json()) as Body;

    const numeroOrden = toStr(body.numeroOrden);
    const version = Number(body.version || 1);
    const creadoPor = toStr(body.creadoPor) || "Sistema";
    const observaciones = toStr(body.observaciones);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!numeroOrden) return NextResponse.json({ success: false, message: "numeroOrden faltante" }, { status: 400 });
    if (!items.length) return NextResponse.json({ success: false, message: "items vacío" }, { status: 400 });

    const spreadsheetId = env.SHEET_BASE_PRINCIPAL_ID;
    const TEMPLATE_NAME = "PlantillaCorte";

    stage = "sheets-client";
    const sheets = await getSheetsClient();

    stage = "find-template-sheet";
    const templateSheetId = await getSheetIdByTitle(sheets, spreadsheetId, TEMPLATE_NAME);
    if (!templateSheetId) throw new Error(`No encontré la hoja plantilla '${TEMPLATE_NAME}'`);

    stage = "duplicate-template";
    tempSheetName = `TMP_${numeroOrden}_V${version}_${Date.now()}`;
    tempSheetId = await duplicateSheet(sheets, spreadsheetId, templateSheetId, tempSheetName);

    /**
     * ✅ Mapeo EXACTO que me diste:
     * Fecha de Generación: E6
     * ORDEN N°: R6
     * Primera fila items: C9
     * Producto final: O9
     * Cantidad final: S9
     */
    stage = "write-values";
    const nowLabel = formatDateTimeCO(new Date());

    const updates: { range: string; values: any[][] }[] = [];

    // Encabezado
    updates.push({ range: `${tempSheetName}!E6`, values: [[nowLabel]] });
    updates.push({ range: `${tempSheetName}!R6`, values: [[numeroOrden]] });

    // Items desde fila 9
    const startRow = 9;

    for (let i = 0; i < items.length; i++) {
      const r = startRow + i;
      const it = items[i];

      // C..J (contiguo)
      // C: Consecutivo
      // D: Cliente
      // E: #OC/Pedido/Cot.
      // F: # Orden Producción
      // G: Producto Inicial
      // H: Cantidad Inicial
      // I: Actividades a Realizar
      // J: Código Siggo Final
      updates.push({
        range: `${tempSheetName}!C${r}:N${r}`,
        values: [[
          toStr(it.consecutivo),
          toStr(it.cliente),
          toStr(it.oc),
          toStr(it.ordenProduccion ?? ""),
          toStr(it.productoInicial),
          "","","",
          toStr(it.cantidadInicial),
          toStr(it.actividades),
          "",
          toStr(it.codigoSiggoFinal ?? ""),
        ]],
      });

      // O..S (contiguo)
      // O: Producto Final (usualmente está mergeado O-R, pero escribir en O funciona)
      // S: Cantidad Final
      // O..S son 5 columnas: O P Q R S
      updates.push({
        range: `${tempSheetName}!O${r}:S${r}`,
        values: [[
          toStr(it.productoFinal),
          "", "", "",
          toStr(it.cantidadFinal),
        ]],
      });
    }

    await batchWriteValues(sheets, spreadsheetId, updates);

    stage = "export-pdf";
    const accessToken = await getAccessTokenFromSheetsClient(sheets);

    // Exporta el sheet duplicado por gid = sheetId
    const exportUrl =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export` +
    `?format=pdf` +
    `&gid=${encodeURIComponent(String(tempSheetId))}` +
    // ✅ Horizontal
    `&portrait=false` +
    // ✅ Ajuste a una página de ancho (se ve “chevere”, no gigante)
    `&fitw=true` +
    // ✅ Tamaño papel: letter (o cámbialo a "legal" / "a4")
    `&size=letter` +
    // ✅ Margenes pequeños
    `&top_margin=0.25&bottom_margin=0.25&left_margin=0.05&right_margin=0.25` +
    // ✅ Centrado
    `&horizontal_alignment=CENTER` +
    // ✅ Opciones visuales
    `&sheetnames=false&printtitle=false&pagenumbers=false` +
    `&gridlines=false&fzr=false`;


    const pdfRes = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!pdfRes.ok) {
      const t = await pdfRes.text().catch(() => "");
      throw new Error(`Error exportando PDF (${pdfRes.status}): ${t || pdfRes.statusText}`);
    }

    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

    stage = "upload-supabase";
    const pdfPath =
      toStr(body.pdfPath) ||
      `${new Date().getFullYear()}/${numeroOrden}/${numeroOrden}_V${version}.pdf`;

    const up = await supabaseAdmin.storage.from("ordenes-corte").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) throw up.error;

    stage = "signed-url";
    const signed = await supabaseAdmin.storage.from("ordenes-corte").createSignedUrl(pdfPath, 60 * 60);
    if (signed.error) throw signed.error;

    stage = "cleanup-temp-sheet";
    await deleteSheet(sheets, spreadsheetId, tempSheetId);
    tempSheetId = null;

    return NextResponse.json({
      success: true,
      pdf_path: pdfPath,
      pdf_signed_url: signed.data?.signedUrl ?? null,
    });
  } catch (err: any) {
    console.error("❌ exportar-pdf ERROR", stage, err);

    // si alcanzó a crear la temporal, intentamos borrarla
    try {
      if (tempSheetId) {
        const sheets = await getSheetsClient();
        await deleteSheet(sheets, env.SHEET_BASE_PRINCIPAL_ID, tempSheetId);
      }
    } catch {}

    return NextResponse.json(
      { success: false, stage, message: err?.message || "Error exportando PDF" },
      { status: 500 }
    );
  }
}

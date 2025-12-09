import { getSheets, PEDIDOS_SHEET_ID, SHEET_CONFIG } from "./googleClient";

export type PedidosConfig = {
  drive_root_folder_id: string;
  info_sheet_id: string;
  inventarios_sheet_id: string;
  estado_inicial: string;
};

export async function getConfig(): Promise<PedidosConfig> {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PEDIDOS_SHEET_ID,
    range: `${SHEET_CONFIG}!A:C`,
  });

  const rows = res.data.values || [];
  if (!rows.length) {
    throw new Error("Config vacío");
  }

  const header = rows[0];
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    idx[String(h)] = i;
  });

  const conf: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const key = r[idx["parametro"]];
    const val = r[idx["valor"]];
    if (key) {
      conf[String(key)] = String(val ?? "");
    }
  }

  if (!conf["drive_root_folder_id"])
    throw new Error('Falta drive_root_folder_id en hoja Config');
  if (!conf["info_sheet_id"])
    throw new Error('Falta info_sheet_id en hoja Config');
  if (!conf["inventarios_sheet_id"])
    throw new Error('Falta inventarios_sheet_id en hoja Config');

  return {
    drive_root_folder_id: conf["drive_root_folder_id"],
    info_sheet_id: conf["info_sheet_id"],
    inventarios_sheet_id: conf["inventarios_sheet_id"],
    estado_inicial: conf["estado_inicial"] || "Ingresado",
  };
}

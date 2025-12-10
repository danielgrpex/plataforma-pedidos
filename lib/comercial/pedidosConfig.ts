// lib/comercial/pedidosConfig.ts
import { env } from "@/lib/config/env";

export type PedidosConfig = {
  drive_root_folder_id: string;
};

// ID de la hoja donde se guardan los pedidos (Base Principal)
export const PEDIDOS_SHEET_ID = env.SHEET_BASE_PRINCIPAL_ID;

// Config general del módulo de pedidos
export const SHEET_CONFIG: PedidosConfig = {
  drive_root_folder_id: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
};

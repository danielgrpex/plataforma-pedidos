import type { Role } from "./roles";

export const MODULE_PERMISSIONS: Record<string, Role[]> = {
  comercial: ["comercial", "planeacion", "admin"],
  planeacion: ["planeacion", "admin"],
  produccion: ["produccion", "admin"],
  abastecimientologistica: ["logistica", "admin"], // usa el nombre real de tu ruta
};

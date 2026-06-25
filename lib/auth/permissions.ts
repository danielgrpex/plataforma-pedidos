// lib/auth/permissions.ts
import type { Role } from "./roles";

/**
 * ✅ Esto ya lo tenías: permisos por módulo (rutas principales)
 * NO se toca, solo se deja igual.
 */
export const MODULE_PERMISSIONS: Record<string, Role[]> = {
  comercial: ["comercial", "planeacion", "logistica", "admin"],
  planeacion: ["planeacion", "admin"],
  produccion: ["produccion", "admin"],
  abastecimientologistica: ["comercial", "logistica", "admin"], // usa el nombre real de tu ruta
};

/**
 * ✅ NUEVO: permisos por pestaña dentro de Producción
 * - Esto NO interfiere con MODULE_PERMISSIONS
 * - Te permite que dentro de /produccion cada correo vea tabs distintas
 */

export type ProduccionTabKey =
  | "cola-inteligente"
  | "pdfs"
  | "reporte-maquinas"
  | "reporte-empaque"
  | "entregas-almacen";

type ProduccionScope =
  | "coordinador_planta"
  | "supervisor"
  | "operario"
  | "almacen";

/** Normaliza email */
function normEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

/**
 * ✅ AJUSTA AQUÍ los correos reales.
 * Puedes poner todos los que necesites.
 */
const PRODUCCION_SCOPE_BY_EMAIL: Record<string, ProduccionScope> = {
  "daniel.alfonso@inplastgr.com": "coordinador_planta",
  "produccionextrusion@inplastgr.com": "coordinador_planta",
  // Supervisores
  // "supervisor1@inplastgr.com": "supervisor",

  // Operarios
  // "operario1@inplastgr.com": "operario",

  // Almacén
  // "almacen1@inplastgr.com": "almacen",
};

/**
 * Tabs permitidas por tipo de usuario (scope).
 * Esto es lo que hace que sea escalable.
 */
const PRODUCCION_TABS_BY_SCOPE: Record<ProduccionScope, ProduccionTabKey[]> = {
  coordinador_planta: ["cola-inteligente","pdfs", "reporte-maquinas", "reporte-empaque", "entregas-almacen"],
  supervisor: ["pdfs", "reporte-maquinas", "reporte-empaque"],
  operario: ["reporte-maquinas", "reporte-empaque"],
  almacen: ["entregas-almacen"],
};

/**
 * Obtiene "scope" según email.
 * - Si es admin o produccion y no está en el mapa, puedes decidir fallback.
 */
export function getProduccionScopeByEmail(email?: string | null): ProduccionScope | null {
  const e = normEmail(email);
  if (!e) return null;
  return PRODUCCION_SCOPE_BY_EMAIL[e] || null;
}

/**
 * Devuelve tabs permitidas para este email.
 * Si el usuario NO está en el mapa, por defecto:
 * - Si quieres que "produccion" vea algo sin registrar email, pon fallback aquí.
 */
export function allowedProduccionTabs(email?: string | null): ProduccionTabKey[] {
  const scope = getProduccionScopeByEmail(email);
  if (!scope) return [];
  return PRODUCCION_TABS_BY_SCOPE[scope] || [];
}

/** Valida si puede ver una tab específica */
export function canAccessProduccionTab(email: string | null | undefined, tab: ProduccionTabKey) {
  return allowedProduccionTabs(email).includes(tab);
}

export function allowedProduccionTabsForUser(params: {
  email?: string | null;
  role?: string | null;
}): ProduccionTabKey[] {
  const role = String(params.role || "").trim().toLowerCase();
  if (role === "admin") {
    return ["cola-inteligente","pdfs", "reporte-maquinas", "reporte-empaque", "entregas-almacen"];
  }

  // si no es admin, se controla por email/scopes
  return allowedProduccionTabs(params.email);
}

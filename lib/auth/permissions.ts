import type { Role } from "./roles";

/* =========================================================
   PERMISOS POR MÓDULO
   ========================================================= */

export const MODULE_PERMISSIONS: Record<string, Role[]> = {
  comercial: [
    "comercial",
    "planeacion",
    "logistica",
    "admin",
  ],

  planeacion: [
    "planeacion",
    "admin",
  ],

  produccion: [
    "produccion",
    "admin",
  ],

  abastecimientologistica: [
    "comercial",
    "logistica",
    "admin",
  ],
};

/* =========================================================
   PRODUCCIÓN
   ========================================================= */

/**
 * Permisos por pestaña dentro de Producción
 */
export type ProduccionTabKey =
  | "cola-inteligente"
  | "pdfs"
  | "reporte-maquinas"
  | "reporte-empaque"
  | "entregas-almacen"
  | "control-producto-proceso";

type ProduccionScope =
  | "coordinador_planta"
  | "supervisor"
  | "operario"
  | "almacen";

/* =========================================================
   HELPERS
   ========================================================= */

/** Normaliza email */
function normEmail(
  email?: string | null
) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Normaliza rol */
function normRole(
  role?: string | null
) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   PRODUCCIÓN - USUARIOS / SCOPES
   ========================================================= */

/**
 * Correos reales por tipo de usuario
 */
const PRODUCCION_SCOPE_BY_EMAIL: Record<
  string,
  ProduccionScope
> = {
  "daniel.alfonso@inplastgr.com":
    "coordinador_planta",

  "produccionextrusion@inplastgr.com":
    "coordinador_planta",

  // Supervisores
  // "supervisor1@inplastgr.com": "supervisor",

  // Operarios
  // "operario1@inplastgr.com": "operario",

  // Almacén
  // "almacen1@inplastgr.com": "almacen",
};

/**
 * Tabs permitidas por tipo de usuario
 */
const PRODUCCION_TABS_BY_SCOPE: Record<
  ProduccionScope,
  ProduccionTabKey[]
> = {
  coordinador_planta: [
    "cola-inteligente",
    "pdfs",
    "reporte-maquinas",
    "reporte-empaque",
    "entregas-almacen",
    "control-producto-proceso",
  ],

  supervisor: [
    "pdfs",
    "reporte-maquinas",
    "reporte-empaque",
    "control-producto-proceso",
  ],

  operario: [
    "reporte-maquinas",
    "reporte-empaque",
  ],

  almacen: [
    "entregas-almacen",
  ],
};

/**
 * Obtiene scope según email
 */
export function getProduccionScopeByEmail(
  email?: string | null
): ProduccionScope | null {
  const e =
    normEmail(email);

  if (!e) {
    return null;
  }

  return (
    PRODUCCION_SCOPE_BY_EMAIL[e] ||
    null
  );
}

/**
 * Devuelve tabs permitidas
 * para este email
 */
export function allowedProduccionTabs(
  email?: string | null
): ProduccionTabKey[] {
  const scope =
    getProduccionScopeByEmail(
      email
    );

  if (!scope) {
    return [];
  }

  return (
    PRODUCCION_TABS_BY_SCOPE[
      scope
    ] || []
  );
}

/**
 * Valida si puede ver
 * una tab específica
 */
export function canAccessProduccionTab(
  email:
    | string
    | null
    | undefined,
  tab: ProduccionTabKey
) {
  return allowedProduccionTabs(
    email
  ).includes(tab);
}

/**
 * Permisos teniendo en cuenta
 * email + rol
 */
export function allowedProduccionTabsForUser(
  params: {
    email?: string | null;
    role?: string | null;
  }
): ProduccionTabKey[] {
  const role =
    normRole(params.role);

  if (role === "admin") {
    return [
      "cola-inteligente",
      "pdfs",
      "reporte-maquinas",
      "reporte-empaque",
      "entregas-almacen",
      "control-producto-proceso",
    ];
  }

  return allowedProduccionTabs(
    params.email
  );
}

/* =========================================================
   ABASTECIMIENTO Y LOGÍSTICA
   ========================================================= */

/**
 * Pestañas disponibles dentro del módulo
 * Abastecimiento y Logística.
 */
export type AbastecimientoLogisticaTabKey =
  | "turneroDespachos"
  | "despachosItems"
  | "itemsListos"
  | "confirmarEntrega"
  | "proveedores"
  | "inventarioProductoProceso";

/**
 * Pestañas tradicionales del módulo.
 *
 * Las conservamos separadas porque actualmente
 * Comercial también puede entrar al módulo.
 */
const ABASTECIMIENTO_TABS_BASE: AbastecimientoLogisticaTabKey[] =
  [
    "turneroDespachos",
    "despachosItems",
    "itemsListos",
    "confirmarEntrega",
    "proveedores",
  ];

/**
 * Pestañas completas para Logística.
 */
const ABASTECIMIENTO_TABS_LOGISTICA: AbastecimientoLogisticaTabKey[] =
  [
    ...ABASTECIMIENTO_TABS_BASE,

    /*
     * Inventario P.P.:
     *
     * Logística podrá:
     * - consultar inventario
     * - realizar conteos
     * - conciliar diferencias
     *
     * pero NO tendrá acceso a las operaciones
     * internas del módulo Producción.
     */
    "inventarioProductoProceso",
  ];

/**
 * Devuelve las pestañas permitidas
 * dentro de Abastecimiento y Logística.
 */
export function allowedAbastecimientoLogisticaTabsForUser(
  params: {
    email?: string | null;
    role?: string | null;
  }
): AbastecimientoLogisticaTabKey[] {
  const role =
    normRole(params.role);

  /*
   * Administrador:
   * acceso completo.
   */
  if (role === "admin") {
    return [
      ...ABASTECIMIENTO_TABS_LOGISTICA,
    ];
  }

  /*
   * Logística:
   * acceso completo al módulo,
   * incluyendo Inventario P.P.
   */
  if (role === "logistica") {
    return [
      ...ABASTECIMIENTO_TABS_LOGISTICA,
    ];
  }

  /*
   * Comercial mantiene exactamente
   * las funciones que ya tenía.
   *
   * No podrá acceder al control
   * de Inventario P.P.
   */
  if (role === "comercial") {
    return [
      ...ABASTECIMIENTO_TABS_BASE,
    ];
  }

  return [];
}

/**
 * Valida una pestaña específica
 * de Abastecimiento y Logística.
 */
export function canAccessAbastecimientoLogisticaTab(
  params: {
    email?: string | null;
    role?: string | null;
  },
  tab: AbastecimientoLogisticaTabKey
) {
  return allowedAbastecimientoLogisticaTabsForUser(
    params
  ).includes(tab);
}
"use client";

import React from "react";
import { useSession } from "next-auth/react";

import {
  allowedAbastecimientoLogisticaTabsForUser,
  type AbastecimientoLogisticaTabKey,
} from "@/lib/auth/permissions";

/* =========================================================
   TIPO DE PESTAÑAS

   Lo exportamos para que page.tsx siga importando TabKey
   como lo hace actualmente.
   ========================================================= */

export type TabKey =
  AbastecimientoLogisticaTabKey;

/* =========================================================
   HELPER DE CLASES
   ========================================================= */

function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export function Tabs({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const {
    data: session,
    status,
  } = useSession();

  const email =
    (session?.user as any)?.email ||
    "";

  const role =
    (session?.user as any)?.role ||
    "";

  const allowedTabs =
    allowedAbastecimientoLogisticaTabsForUser(
      {
        email,
        role,
      }
    );

  const canSeeInventarioPP =
    allowedTabs.includes(
      "inventarioProductoProceso"
    );

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-neutral-200 px-4 pt-4">
        <div className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
          {/* =============================================
              PROGRAMACIÓN DE DESPACHOS
             ============================================= */}

          <TabButton
            active={
              tab ===
              "turneroDespachos"
            }
            onClick={() =>
              setTab(
                "turneroDespachos"
              )
            }
          >
            Programación de despachos
          </TabButton>

          {/* =============================================
              DESPACHOS POR ÍTEMS
             ============================================= */}

          <TabButton
            active={
              tab ===
              "despachosItems"
            }
            onClick={() =>
              setTab(
                "despachosItems"
              )
            }
          >
            Despachos por ítems
          </TabButton>

          {/* =============================================
              ÍTEMS LISTOS
             ============================================= */}

          <TabButton
            active={
              tab ===
              "itemsListos"
            }
            onClick={() =>
              setTab(
                "itemsListos"
              )
            }
          >
            Ítems listos para despacho
          </TabButton>

          {/* =============================================
              CONFIRMAR ENTREGA
             ============================================= */}

          <TabButton
            active={
              tab ===
              "confirmarEntrega"
            }
            onClick={() =>
              setTab(
                "confirmarEntrega"
              )
            }
          >
            Confirmar entrega al cliente
          </TabButton>

          {/* =============================================
              PROVEEDORES
             ============================================= */}

          <TabButton
            active={
              tab ===
              "proveedores"
            }
            onClick={() =>
              setTab(
                "proveedores"
              )
            }
          >
            Ingreso de proveedores
          </TabButton>

          {/* =============================================
              INVENTARIO PRODUCTO EN PROCESO

              Solamente visible para:
              - Logística
              - Admin

              Comercial NO la verá.
             ============================================= */}

          {status !== "loading" &&
          canSeeInventarioPP ? (
            <TabButton
              active={
                tab ===
                "inventarioProductoProceso"
              }
              onClick={() =>
                setTab(
                  "inventarioProductoProceso"
                )
              }
            >
              Inventario producto en proceso
            </TabButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   BOTÓN DE PESTAÑA
   ========================================================= */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-lg px-4 py-2 text-sm font-medium transition",

        active
          ? "bg-white text-orange-700 shadow-sm ring-1 ring-black/5"
          : "text-neutral-600 hover:bg-white hover:text-neutral-900"
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
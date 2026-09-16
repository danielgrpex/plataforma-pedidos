"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { TurneroDespachosTab } from "./_components/TurneroDespachosTab";
import { Tabs, TabKey } from "./_components/Tabs";
import { DespachosItemsTab } from "./_components/DespachosItemsTab";
import { ItemsListosTab } from "./_components/ItemsListosTab";
import { ConfirmarEntregaTab } from "./_components/ConfirmarEntregaTab";
import { ProveedoresTab } from "./_components/ProveedoresTab";
import { InventarioProductoProcesoTab } from "./_components/InventarioProductoProcesoTab";

import {
  allowedAbastecimientoLogisticaTabsForUser,
} from "@/lib/auth/permissions";

export default function AbastecimientoLogisticaPage() {
  const { data: session, status } =
    useSession();

  const email =
    (session?.user as any)?.email || "";

  const role =
    (session?.user as any)?.role || "";

  const allowedTabs =
    allowedAbastecimientoLogisticaTabsForUser(
      {
        email,
        role,
      }
    );

  const [tab, setTab] =
    useState<TabKey>(
      "turneroDespachos"
    );

  /* =========================================================
     DEEP LINK
     ========================================================= */

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    if (
      status === "loading"
    ) {
      return;
    }

    const url =
      new URL(
        window.location.href
      );

    const requestedTab =
      url.searchParams.get(
        "tab"
      ) as TabKey | null;

    if (!requestedTab) {
      return;
    }

    /*
     * Muy importante:
     *
     * No basta con que el TabKey exista.
     * También verificamos que el usuario
     * tenga permiso para esa pestaña.
     *
     * Así alguien no puede abrir manualmente:
     *
     * ?tab=inventarioProductoProceso
     *
     * si su rol no lo permite.
     */
    if (
      allowedTabs.includes(
        requestedTab
      )
    ) {
      setTab(
        requestedTab
      );
    }
  }, [
    status,
    email,
    role,
  ]);

  /* =========================================================
     CAMBIAR TAB
     ========================================================= */

  function cambiarTab(
    nuevaTab: TabKey
  ) {
    if (
      !allowedTabs.includes(
        nuevaTab
      )
    ) {
      return;
    }

    setTab(
      nuevaTab
    );

    /*
     * Guardamos la pestaña en la URL
     * sin recargar la página.
     *
     * Esto permite copiar enlaces como:
     *
     * /abastecimientologistica?tab=inventarioProductoProceso
     */
    if (
      typeof window !==
      "undefined"
    ) {
      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        "tab",
        nuevaTab
      );

      window.history.replaceState(
        {},
        "",
        url.toString()
      );
    }
  }

  /* =========================================================
     SESIÓN
     ========================================================= */

  if (
    status === "loading"
  ) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <main className="mx-auto w-full max-w-6xl px-6 py-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">
              Cargando...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =========================================================
     SEGURIDAD DE TAB ACTUAL
     ========================================================= */

  const tabPermitida =
    allowedTabs.includes(
      tab
    );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ===================================================
            HEADER
           =================================================== */}

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-100">
                Abastecimiento y logística
              </span>

              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                Módulo
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Abastecimiento y logística
            </h1>

            <p className="mt-1 text-sm text-neutral-600">
              Entradas de proveedores + despachos + confirmación de entrega al cliente + control de inventario.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Inicio
          </Link>
        </div>

        {/* ===================================================
            TABS
           =================================================== */}

        <Tabs
          tab={tab}
          setTab={
            cambiarTab
          }
        />

        {/* ===================================================
            CONTENT
           =================================================== */}

        <div className="mt-6 space-y-4">
          {!tabPermitida ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-base font-semibold text-red-800">
                Acceso no autorizado
              </h2>

              <p className="mt-1 text-sm text-red-700">
                Tu usuario no tiene permisos para ingresar a esta sección.
              </p>
            </div>
          ) : (
            <>
              {tab ===
                "turneroDespachos" && (
                <TurneroDespachosTab />
              )}

              {tab ===
                "despachosItems" && (
                <DespachosItemsTab />
              )}

              {tab ===
                "itemsListos" && (
                <ItemsListosTab />
              )}

              {tab ===
                "confirmarEntrega" && (
                <ConfirmarEntregaTab />
              )}

              {tab ===
                "proveedores" && (
                <ProveedoresTab />
              )}

              {tab ===
                "inventarioProductoProceso" && (
                <InventarioProductoProcesoTab />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
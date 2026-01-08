// app/abastecimientologistica/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Tabs, TabKey } from "./_components/Tabs";
import { DespachosItemsTab } from "./_components/DespachosItemsTab";
import { ItemsListosTab } from "./_components/ItemsListosTab";
import { ConfirmarEntregaTab } from "./_components/ConfirmarEntregaTab";
import { ProveedoresTab } from "./_components/ProveedoresTab";
import { DespachosOrdenTab } from "./_components/DespachosOrdenTab";

export default function AbastecimientoLogisticaPage() {
  const [tab, setTab] = useState<TabKey>("despachosItems");

  // Opcional: permitir deep-link por query (?tab=confirmarEntrega)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tab") as TabKey | null;
    if (
      t &&
      ["despachosItems", "itemsListos", "despachosOrden", "confirmarEntrega", "proveedores"].includes(t)
    ) {
      setTab(t);
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Header estilo Producción */}
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
              Entradas de proveedores + despachos + confirmación de entrega al cliente.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Inicio
          </Link>
        </div>

        {/* Tabs */}
        <Tabs tab={tab} setTab={setTab} />

        {/* Content */}
        <div className="mt-6 space-y-4">
          {tab === "despachosItems" && <DespachosItemsTab />}
          {tab === "itemsListos" && <ItemsListosTab />}
          {tab === "despachosOrden" && <DespachosOrdenTab />}
          {tab === "confirmarEntrega" && <ConfirmarEntregaTab />}
          {tab === "proveedores" && <ProveedoresTab />}
        </div>
      </main>
    </div>
  );
}

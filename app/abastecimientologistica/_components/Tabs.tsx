//app/abastecimientologistica/_components/Tabs.tsx
"use client";

import React from "react";

export type TabKey =
  | "despachosItems"
  | "itemsListos"
  | "despachosOrden"
  | "confirmarEntrega"
  | "proveedores";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Tabs({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-neutral-200 px-4 pt-4">
        <div className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
          <TabButton active={tab === "despachosItems"} onClick={() => setTab("despachosItems")}>
            Despachos por items
          </TabButton>

          <TabButton active={tab === "itemsListos"} onClick={() => setTab("itemsListos")}>
            Ítems listos para despacho
          </TabButton>

          <TabButton active={tab === "despachosOrden"} onClick={() => setTab("despachosOrden")}>
            Despachos por orden completa
          </TabButton>

          <TabButton active={tab === "confirmarEntrega"} onClick={() => setTab("confirmarEntrega")}>
            Confirmar entrega al cliente
          </TabButton>

          <TabButton active={tab === "proveedores"} onClick={() => setTab("proveedores")}>
            Ingreso de proveedores
          </TabButton>
        </div>
      </div>
    </div>
  );
}

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

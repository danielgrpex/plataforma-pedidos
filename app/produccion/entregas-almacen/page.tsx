//app/produccion/entregas-almacen/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "actualizar" | "entregar";

export default function EntregasAlmacenPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("actualizar");

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Entregas a almacén</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Actualiza estados (producción/corte) y realiza entregas de empacado a inventario.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion")}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Inicio
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="inline-flex rounded-xl bg-neutral-100 p-1">
              <TabButton active={tab === "actualizar"} onClick={() => setTab("actualizar")}>
                Actualizar Estado
              </TabButton>
              <TabButton active={tab === "entregar"} onClick={() => setTab("entregar")}>
                Entregar a almacén
              </TabButton>
            </div>
          </div>

          <div className="p-6">
            {tab === "actualizar" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Actualizar Estado</h2>
                <p className="text-sm text-neutral-600">
                  Producción: OPE en cola (item por item). Corte: OTE generada → Empacado.
                </p>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Ir a Actualizar Estado</p>
                      <p className="text-xs text-neutral-600">Listar items y cambiar estado.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/produccion/entregas-almacen/actualizar")}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Entregar a almacén</h2>
                <p className="text-sm text-neutral-600">
                  Lista OPE/OTE empacados. Luego haremos el movimiento de inventario y actualizar Pedidos.
                </p>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Ir a Entregar</p>
                      <p className="text-xs text-neutral-600">Solo empacados.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/produccion/entregas-almacen/entregar")}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
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
      className={[
        "rounded-lg px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
          : "text-neutral-600 hover:text-neutral-900",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

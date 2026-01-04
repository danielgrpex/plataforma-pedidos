"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "iniciar" | "finalizar";

export default function ReporteEmpaquePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("iniciar");

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Registro Operativo — Empaque
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Control de inicio y finalización de órdenes de empaque.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="inline-flex rounded-xl bg-neutral-100 p-1">
              <TabButton active={tab === "iniciar"} onClick={() => setTab("iniciar")}>
                Iniciar Orden
              </TabButton>
              <TabButton active={tab === "finalizar"} onClick={() => setTab("finalizar")}>
                Finalizar Orden
              </TabButton>
            </div>
          </div>

          <div className="p-6">
            {tab === "iniciar" ? (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Iniciar Orden</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Registrar el inicio de una orden de empaque.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Inicio Empaque
                      </p>
                      <p className="text-xs text-neutral-600">
                        Seleccionar OTE (Generada) + trabajador.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push("/produccion/reporte-empaque/iniciar")}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-900"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Finalizar Orden</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Registrar el cierre/finalización de una orden de empaque.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Finalizar Empaque
                      </p>
                      <p className="text-xs text-neutral-600">
                        (Lo implementamos en el siguiente paso).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push("/produccion/reporte-empaque/finalizar")}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-900"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </section>
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

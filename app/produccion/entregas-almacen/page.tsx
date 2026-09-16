"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "actualizar" | "entregar";

export default function EntregasAlmacenPage() {
  const router = useRouter();

  const [tab, setTab] =
    useState<TabKey>("actualizar");

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ===================================================
            CABECERA
           =================================================== */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Entregas a almacén
            </h1>

            <p className="mt-1 text-sm text-neutral-600">
              Gestiona el estado de producción y confirma la entrega de producto empacado a almacén.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/produccion")
            }
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Inicio
          </button>
        </div>

        {/* ===================================================
            CONTENEDOR PRINCIPAL
           =================================================== */}

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {/* =================================================
              TABS
             ================================================= */}

          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="inline-flex rounded-xl bg-neutral-100 p-1">
              <TabButton
                active={
                  tab === "actualizar"
                }
                onClick={() =>
                  setTab("actualizar")
                }
              >
                Actualizar Estado
              </TabButton>

              <TabButton
                active={
                  tab === "entregar"
                }
                onClick={() =>
                  setTab("entregar")
                }
              >
                Entregar a almacén
              </TabButton>
            </div>
          </div>

          {/* =================================================
              CONTENIDO
             ================================================= */}

          <div className="p-6">
            {tab === "actualizar" ? (
              <div className="space-y-5">
                {/* ===========================================
                    ACTUALIZAR ESTADO
                   =========================================== */}

                <div>
                  <h2 className="text-lg font-semibold">
                    Actualizar Estado
                  </h2>

                  <p className="mt-1 text-sm text-neutral-600">
                    Actualiza el estado operativo de los ítems de producción (OPE).
                  </p>
                </div>

                {/* ===========================================
                    AVISO CONTROL P.P.
                   =========================================== */}

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-800">
                    Corte y empaque se gestionan automáticamente
                  </div>

                  <p className="mt-1 text-sm text-emerald-700">
                    Los ítems de OTE pasan de{" "}
                    <b>Generada → Empacado</b>{" "}
                    únicamente cuando Control Producto en Proceso confirma que la cantidad pendiente llegó a 0.
                  </p>

                  <p className="mt-2 text-xs text-emerald-700">
                    Ya no es necesario ni está permitido marcar manualmente una orden de corte como Empacada.
                  </p>
                </div>

                {/* ===========================================
                    TARJETA ACTUALIZAR OPE
                   =========================================== */}

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Producción (OPE)
                      </p>

                      <p className="mt-1 text-xs text-neutral-600">
                        Lista ítems de producción y actualiza su estado operativo.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/produccion/entregas-almacen/actualizar"
                        )
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* ===========================================
                    ENTREGAR A ALMACÉN
                   =========================================== */}

                <div>
                  <h2 className="text-lg font-semibold">
                    Entregar a almacén
                  </h2>

                  <p className="mt-1 text-sm text-neutral-600">
                    Consulta los ítems que PEX ya confirmó como Empacados y registra su entrega física a almacén.
                  </p>
                </div>

                {/* ===========================================
                    EXPLICACIÓN DEL FLUJO
                   =========================================== */}

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-800">
                    Solo aparecen productos listos para entregar
                  </div>

                  <p className="mt-1 text-sm text-blue-700">
                    Para las órdenes de corte, PEX habilita la entrega únicamente después de completar la cantidad solicitada mediante Control Producto en Proceso.
                  </p>

                  <p className="mt-2 text-xs text-blue-700">
                    Las entregas pueden ser parciales y cada movimiento queda registrado en el historial.
                  </p>
                </div>

                {/* ===========================================
                    TARJETA ENTREGAR
                   =========================================== */}

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Producto pendiente por entregar
                      </p>

                      <p className="mt-1 text-xs text-neutral-600">
                        Consulta producto Empacado y registra su entrega a almacén.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/produccion/entregas-almacen/entregar"
                        )
                      }
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
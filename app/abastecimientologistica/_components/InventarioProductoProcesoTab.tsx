"use client";

import Link from "next/link";

type Opcion = {
  title: string;
  desc: string;
  badge: string;
  href?: string;
  disponible: boolean;
};

export function InventarioProductoProcesoTab() {
  const opciones: Opcion[] = [
    {
      title: "Inventario actual",
      desc: "Consulta las existencias disponibles de producto en proceso por OPE, producto y medida.",
      badge: "Consulta",
      href: "/abastecimientologistica/inventario-producto-proceso/inventario",
      disponible: true,
    },
    {
  title: "Nuevo conteo físico",
  desc: "Registra un conteo semanal, mensual o extraordinario y compara las cantidades físicas contra PEX.",
  badge: "Conteo",
  href: "/abastecimientologistica/inventario-producto-proceso/conteo",
  disponible: true,
},
    {
  title: "Historial de conteos",
  desc: "Consulta conteos realizados, diferencias detectadas y ajustes aplicados al inventario.",
  badge: "Trazabilidad",
  href: "/abastecimientologistica/inventario-producto-proceso/historial",
  disponible: true,
},
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      {/* ===================================================
          CABECERA
         =================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
            Producto en proceso
          </div>

          <h2 className="mt-3 text-xl font-semibold text-neutral-900">
            Inventario producto en proceso
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Consulta las existencias oficiales de producto en proceso y realiza
            posteriormente los conteos físicos para conciliar diferencias contra
            PEX.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Fuente oficial
          </div>

          <div className="mt-1 text-sm font-medium text-emerald-900">
            Inventario PEX
          </div>
        </div>
      </div>

      {/* ===================================================
          AVISO
         =================================================== */}

      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm font-semibold text-blue-900">
          Mismo inventario de Producción
        </div>

        <p className="mt-1 text-sm text-blue-700">
          Esta sección consulta el mismo inventario oficial de Producto en
          Proceso. No existe una base independiente para Abastecimiento y
          Logística.
        </p>
      </div>

      {/* ===================================================
          OPCIONES
         =================================================== */}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {opciones.map((opcion) => {
          const contenido = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold text-neutral-900">
                  {opcion.title}
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    opcion.disponible
                      ? "bg-orange-50 text-orange-700"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {opcion.badge}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-neutral-600">
                {opcion.desc}
              </p>

              <div
                className={`mt-5 text-sm font-semibold ${
                  opcion.disponible
                    ? "text-orange-700"
                    : "text-neutral-400"
                }`}
              >
                {opcion.disponible
                  ? "Entrar →"
                  : "Próximamente"}
              </div>
            </>
          );

          if (
            opcion.disponible &&
            opcion.href
          ) {
            return (
              <Link
                key={opcion.title}
                href={opcion.href}
                className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/30"
              >
                {contenido}
              </Link>
            );
          }

          return (
            <div
              key={opcion.title}
              className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5"
            >
              {contenido}
            </div>
          );
        })}
      </div>

      {/* ===================================================
          FLUJO FUTURO
         =================================================== */}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-sm font-semibold text-neutral-900">
          Flujo de conciliación
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-600">
          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200">
            Inventario PEX
          </span>

          <span>→</span>

          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200">
            Conteo físico
          </span>

          <span>→</span>

          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200">
            Comparación
          </span>

          <span>→</span>

          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200">
            Ajuste con trazabilidad
          </span>
        </div>
      </div>
    </section>
  );
}
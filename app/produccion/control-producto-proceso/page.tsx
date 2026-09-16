"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

export default function ControlProductoProcesoPage() {
  const { data: session, status } = useSession();

  const email =
    (session?.user as any)?.email || "";

  const role =
    (session?.user as any)?.role || "";

  const allowedTabs =
    allowedProduccionTabsForUser({
      email,
      role,
    });

  const canAccess =
    allowedTabs.includes(
      "control-producto-proceso"
    );

  /* =========================================================
     SESIÓN / PERMISOS
     ========================================================= */

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Acceso no autorizado
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Tu usuario no tiene permisos para ingresar al Control de Producto en Proceso.
          </p>

          <Link
            href="/produccion"
            className="mt-4 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            ← Volver a Producción
          </Link>
        </div>
      </main>
    );
  }

  /* =========================================================
     OPERACIONES
     ========================================================= */

  const opciones: {
    title: string;
    desc: string;
    badge: string;
    href: string;
  }[] = [
    {
      title: "Inventario actual",
      desc: "Consulta las existencias disponibles por OPE, producto y medida.",
      badge: "Inventario",
      href: "/produccion/control-producto-proceso/inventario",
    },
    {
      title: "Entrega de producción",
      desc: "Registra el conteo físico entregado por el supervisor al finalizar cada turno.",
      badge: "Máquinas",
      href: "/produccion/control-producto-proceso/entrega-produccion",
    },
    {
      title: "Consumo de empaque",
      desc: "Registra salidas, transformaciones y remanentes utilizados para atender las órdenes de corte.",
      badge: "Empaque",
      href: "/produccion/control-producto-proceso/consumo-empaque",
    },
    {
      title: "Historial de movimientos",
      desc: "Consulta entradas, salidas, transformaciones, ajustes y trazabilidad por lote.",
      badge: "Kardex",
      href: "/produccion/control-producto-proceso/historial",
    },
    {
      title: "Cargue inicial",
      desc: "Incorpora al inventario PEX las existencias físicas encontradas al iniciar el control.",
      badge: "Inicial",
      href: "/produccion/control-producto-proceso/cargue-inicial",
    },
  ];

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* =====================================================
          CABECERA
         ===================================================== */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Producción · Control Producto en Proceso
          </div>

          <h1 className="text-2xl font-semibold">
            Control Producto en Proceso
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Control de existencias por OPE, entregas de producción, consumos,
            transformaciones, remanentes y trazabilidad.
          </p>
        </div>

        <Link
          href="/produccion"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Producción
        </Link>
      </div>

      {/* =====================================================
          OPERACIONES
         ===================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">
            Operaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Selecciona la operación que deseas realizar.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {opciones.map((opcion) => (
            <Link
              key={opcion.title}
              href={opcion.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  {opcion.title}
                </div>

                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {opcion.badge}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-600">
                {opcion.desc}
              </p>

              <div className="mt-3 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
                Entrar →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =====================================================
          FLUJO
         ===================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">
          Flujo del control
        </h2>

        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>
            El cargue inicial incorpora las existencias físicas que ya estaban en planta al momento de iniciar el control.
          </li>

          <li>
            El supervisor registra el conteo físico producido al finalizar cada turno.
          </li>

          <li>
            PEX suma la producción al inventario del lote y medida correspondiente.
          </li>

          <li>
            Empaque registra qué material consume para atender una OTE.
          </li>

          <li>
            PEX descuenta el material utilizado y registra las piezas buenas obtenidas.
          </li>

          <li>
            Los remanentes aprovechables vuelven al inventario con su nueva medida.
          </li>

          <li>
            Cuando un consecutivo completa la cantidad solicitada, PEX lo marca automáticamente como Empacado.
          </li>

          <li>
            Todos los movimientos quedan registrados en el historial para conservar la trazabilidad por lote.
          </li>
        </ol>
      </section>
    </main>
  );
}
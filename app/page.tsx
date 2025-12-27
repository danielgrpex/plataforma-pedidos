// app/page.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const { data, status } = useSession();
  const role = (data?.user as any)?.role as string | undefined;

  const isAuthed = status === "authenticated";

  // ✅ permisos reales (solo aplican cuando está logueado)
  const canAccess = {
    comercial: role === "comercial" || role === "planeacion" || role === "admin",
    planeacion: role === "planeacion" || role === "admin",
    produccion: role === "produccion" || role === "admin",
    logistica: role === "logistica" || role === "admin",
  };

  // ✅ si NO está logueado, se ve todo normal, pero NO entra a módulos
  const guestHref = "/api/auth/signin"; // <- si lo quieres a /403, cambia aquí por "/403"

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start">
          {/* Texto principal */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistema interno · PEX
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                Sistema de información{" "}
                <span className="relative inline-flex items-center">
                  PEX
                  <span className="absolute inset-x-0 bottom-0 -z-10 h-3 translate-y-1 rounded-md bg-emerald-100" />
                </span>{" "}
                - Proceso de Extrusión.
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                Un solo lugar para crear pedidos, coordinar despachos, generar órdenes de
                trabajo y producción, controlar inventarios conectados con Google Sheets.
                Diseñado a la medida de los procesos de extrusión de GR.
              </p>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
                Integrado con Google Sheets
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
                Procesos de corte y extrusión
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
                Hecho a la medida de GR
              </span>
            </div>
          </div>

          {/* Resumen del sistema */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Resumen del sistema
                </p>
                <p className="text-xs text-slate-500">
                  Vista rápida de los módulos conectados.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <ResumenItem
                titulo="Pedidos"
                descripcion="Creación de pedidos comerciales y seguimiento."
                etiqueta="Comercial"
                color="text-sky-600 bg-sky-50"
              />
              <ResumenItem
                titulo="Programación"
                descripcion="Generación automática de órdenes de trabajo y producción."
                etiqueta="Producción"
                color="text-violet-600 bg-violet-50"
              />
              <ResumenItem
                titulo="Inventarios"
                descripcion="Movimientos controlados por Kardex central."
                etiqueta="Abastecimiento y Logística"
                color="text-amber-600 bg-amber-50"
              />
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Todo conectado con la información que ya manejan en sus hojas de cálculo,
              pero con una interfaz mucho más cómoda para el equipo.
            </p>
          </div>
        </section>

        {/* Módulos */}
        <section id="modulos" className="mt-16 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Módulos del sistema</h2>
            <p className="text-xs text-slate-500">
              Cada área tiene su propio espacio, pero todos comparten la misma información de fondo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ModuloCard
              sigla="CO"
              titulo="Comercial"
              descripcion="Registro de pedidos, condiciones comerciales y revisa estado de cada solicitud."
              estado="Activo"
              href={isAuthed ? "/comercial" : guestHref}
              enabled={isAuthed ? canAccess.comercial : true}
              locked={!isAuthed}
            />

            <ModuloCard
              sigla="PL"
              titulo="Planeación"
              descripcion="Verificación y clasificación item por item de cada pedido."
              estado="Activo"
              href={isAuthed ? "/planeacion" : guestHref}
              enabled={isAuthed ? canAccess.planeacion : true}
              locked={!isAuthed}
            />

            <ModuloCard
              sigla="PR"
              titulo="Producción"
              descripcion="Generación de OPE y OTE. Programación de máquinas y control operativo."
              estado="Activo"
              href={isAuthed ? "/produccion" : guestHref}
              enabled={isAuthed ? canAccess.produccion : true}
              locked={!isAuthed}
            />

            <ModuloCard
              sigla="AL"
              titulo="Abastecimiento y Logística"
              descripcion="Inventarios, despachos, facturación y seguimiento de entregas."
              estado="Activo"
              href={isAuthed ? "/abastecimientologistica" : guestHref}
              enabled={isAuthed ? canAccess.logistica : true}
              locked={!isAuthed}
            />
          </div>
        </section>

        {/* Flujo de información */}
        <section className="mt-16 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Cómo fluye la información</h2>
            <p className="text-xs text-slate-500">
              Desde comercial se alimenta la información y termina en el despacho de cada producto.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <PasoCard
              numero="01"
              titulo="Comercial"
              descripcion="Se crea el pedido comercial con toda la información del cliente y productos."
            />
            <PasoCard
              numero="02"
              titulo="Planeación"
              descripcion="Verifica que comercial ingrese correctamente el pedido y lo clasifica según inventario."
            />
            <PasoCard
              numero="03"
              titulo="Producción"
              descripcion="Programa líneas de producción y generan las órdenes de corte y extrusión."
            />
            <PasoCard
              numero="04"
              titulo="Abastecimiento y Logística"
              descripcion="Recibe materia prima, controla inventarios y alimenta infomación de despachos."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ResumenItem({ titulo, descripcion, etiqueta, color }: any) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div>
        <p className="text-xs font-semibold text-slate-800">{titulo}</p>
        <p className="text-[11px] text-slate-500">{descripcion}</p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
        {etiqueta}
      </span>
    </div>
  );
}

function ModuloCard({
  sigla,
  titulo,
  descripcion,
  estado,
  href,
  enabled,
  locked,
}: {
  sigla: string;
  titulo: string;
  descripcion: string;
  estado: string;
  href: string;
  enabled: boolean;
  locked: boolean;
}) {
  const esActivo = estado === "Activo";

  const disabledWrap = "opacity-45 grayscale cursor-not-allowed";
  const disabledLink = "pointer-events-none";

  return (
    <div
      className={
        "flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm " +
        (!enabled ? disabledWrap : "")
      }
      title={!enabled ? "Acceso no habilitado para tu rol" : locked ? "Inicia sesión para acceder" : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
            {sigla}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">{titulo}</p>
            <p className="text-[11px] text-slate-500">{descripcion}</p>
          </div>
        </div>

        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-medium " +
            (esActivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")
          }
        >
          {estado}
        </span>
      </div>

      {/* ✅ si está logueado pero no habilitado => deshabilitar link
          ✅ si NO está logueado => link sí funciona pero manda a login (/api/auth/signin) */}
      <Link
        href={href}
        className={
          "mt-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 " +
          (isLockedButNoPerm(enabled, locked) ? disabledLink : "")
        }
        aria-disabled={isLockedButNoPerm(enabled, locked)}
        tabIndex={isLockedButNoPerm(enabled, locked) ? -1 : 0}
      >
        Ir al módulo →
      </Link>

      {!enabled && <p className="mt-1 text-[11px] text-slate-400">No habilitado para tu rol</p>}
      {locked && <p className="mt-1 text-[11px] text-slate-400">Inicia sesión para acceder</p>}
    </div>
  );
}

function isLockedButNoPerm(enabled: boolean, locked: boolean) {
  // si NO está logueado, queremos que el link funcione (manda a login)
  if (locked) return false;
  // si está logueado pero no tiene permiso, entonces sí deshabilitamos
  return !enabled;
}

function PasoCard({ numero, titulo, descripcion }: any) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-[11px] font-medium text-slate-400">PASO {numero}</span>
      <p className="text-xs font-semibold text-slate-900">{titulo}</p>
      <p className="mt-1 text-[11px] text-slate-500">{descripcion}</p>
    </div>
  );
}

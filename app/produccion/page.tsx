// app/produccion/page.tsx
// app/produccion/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabs, type ProduccionTabKey } from "@/lib/auth/permissions";

const TAB_META: Record<
  ProduccionTabKey,
  { title: string; desc: string; href: string; badge?: string }
> = {
  pdfs: {
    title: "Generar PDF´s",
    desc: "Imprimir órdenes: OPE en cola + OTE programadas.",
    href: "/produccion/pdfs",
    badge: "Documentos",
  },
  "reporte-maquinas": {
    title: "Reporte Operario Máquinas",
    desc: "Registro de producción en máquina (inicio/fin, cantidades, novedades).",
    href: "/produccion/reporte-maquinas",
    badge: "Planta",
  },
  "reporte-empaque": {
    title: "Reporte Operario Empaque",
    desc: "Registro de empaque (un embudo: 1 trabajo a la vez).",
    href: "/produccion/reporte-empaque",
    badge: "Empaque",
  },
  "entregas-almacen": {
    title: "Entregas a almacén",
    desc: "Confirmar entregas de producto empacado y pasar a logística/almacén.",
    href: "/produccion/entregas-almacen",
    badge: "Almacén",
  },
};

const ALL_TABS: ProduccionTabKey[] = [
  "pdfs",
  "reporte-maquinas",
  "reporte-empaque",
  "entregas-almacen",
];

export default function ProduccionHomePage() {
  // ✅ Renombramos data -> session para evitar errores
  const { data: session } = useSession();

  const email = (session?.user as any)?.email || "";
  const role = (session?.user as any)?.role as string | undefined;

  // ✅ Admin ve todo; los demás por email (tu lógica actual)
  const allowed = useMemo(() => {
    if ((role || "").toLowerCase() === "admin") return ALL_TABS;
    return allowedProduccionTabs(email);
  }, [email, role]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-sm text-slate-500">
            Módulo operativo de planta. Acceso según usuario.
            {role ? (
              <>
                {" "}
                · Rol:{" "}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {role}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Inicio
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Accesos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona una sección para trabajar. Solo verás lo que tu correo tiene permitido.
        </p>

        {allowed.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No tienes permisos para entrar a Producción con este usuario (<b>{email || "sin email"}</b>).
            Revisa <code className="mx-1 rounded bg-white px-1">lib/auth/permissions.ts</code>.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {allowed.map((k) => {
              const t = TAB_META[k];
              return (
                <Link
                  key={k}
                  href={t.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                    {t.badge ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {t.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{t.desc}</p>
                  <div className="mt-3 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
                    Entrar →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Flujo (resumen)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Planeación programa OPE/OTE y Empaque (prioridad).</li>
          <li>Planta ejecuta (máquinas / corte / empaque) y reporta operación.</li>
          <li>Se entrega a almacén lo empacado y luego logística despacha.</li>
        </ol>
      </section>
    </main>
  );
}

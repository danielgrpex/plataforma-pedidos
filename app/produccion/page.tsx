// app/produccion/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";

export default async function ProduccionPage() {
  const session = await getAuthSession();
  // @ts-ignore
  const role = session?.user?.role;

  if (!session || (role !== "produccion" && role !== "admin")) {
    redirect("/sin-acceso");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Módulo Producción</h1>
          <p className="mt-2 text-sm text-slate-600">
            Panel de producción: cortes, órdenes en proceso, tiempos, etc.
          </p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Corte */}
        <Link
          href="/produccion/corte"
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Corte
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Ver items con estado <b>Corte</b>, generar órdenes de corte y gestionarlas.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 group-hover:bg-white">
              Entrar →
            </span>
          </div>
        </Link>

        {/* Placeholder: Producción / Ordenes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Órdenes de producción
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                (Próximo) Seguimiento de órdenes, consumos, avances y cierres.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-400">
              Próximamente
            </span>
          </div>
        </div>
      </section>

      {/* Nota */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Tip: Planeación deja los items en estado <b>Corte</b>. Producción los toma desde{" "}
          <b>/produccion/corte</b> y genera la <b>Orden de Corte</b>.
        </p>
      </section>
    </main>
  );
}

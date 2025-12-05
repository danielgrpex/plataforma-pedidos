// app/produccion/page.tsx

export default function ProduccionPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-start">
        {/* Columna izquierda: título y descripción */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Módulo de Producción
          </h1>
          <p className="mt-4 max-w-xl text-slate-600">
            Panel para coordinar extrusión, cortes y empaques. Aquí
            conectaremos las órdenes de trabajo que ya estamos generando en
            Google Sheets.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                OT de Corte
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Acceso rápido a las órdenes de corte y al estado de cada ítem.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Extrusión
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Resumen de producción por línea y por turno (placeholder).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Empaque
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Control de empaques y cierre de OT (placeholder).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Indicadores
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Aquí pondremos KPIs de eficiencia, desperdicio, etc.
              </p>
            </div>
          </div>
        </div>

        {/* Columna derecha: “próximamente” */}
        <aside className="mt-8 w-full max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 lg:mt-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Próximamente
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Aquí vamos a conectar directamente con las OT de corte que ya
            generas en Google Sheets para que producción pueda ver todo en un
            solo lugar.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            De momento es sólo una pantalla de prueba para que vayamos
            construyendo la estructura del sistema.
          </p>
        </aside>
      </section>
    </main>
  );
}

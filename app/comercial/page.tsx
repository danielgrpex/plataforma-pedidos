export default function ComercialHomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Encabezado */}
      <section className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
            Módulo Comercial
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Pedidos comerciales
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Crea y gestiona los pedidos comerciales que alimentan todo el
            sistema PEX.
          </p>
        </div>

        <a
          href="/comercial/nuevo"
          className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-5 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50"
        >
          + Crear nuevo pedido
        </a>
      </section>

      {/* Próximamente: listado de pedidos */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">
        Aquí irá el listado de pedidos conectados con Google Sheets.
        <br />
        Por ahora no hay pedidos para mostrar.
      </section>
    </main>
  );
}

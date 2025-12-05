// app/page.tsx
import Image from "next/image";

const navItems = [
  { label: "Inicio", href: "#inicio" },
  { label: "Ventas", href: "#ventas" },
  { label: "Logística", href: "#logistica" },
  { label: "Producción", href: "#produccion" },
  { label: "Almacén", href: "#almacen" },
];

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-100">
      {/* Línea superior con gradiente */}
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400" />

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo + título */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-500 shadow-sm">
            <Image
              src="/logo-gr.png"
              alt="Industrias Plásticas GR"
              fill
              className="object-contain p-1"
            />
          </div>

          <div className="leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
              Industrias Plásticas GR
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              Sistema de información
              {/* Badge PEX elegante */}
              <span className="relative inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="relative z-10">PEX</span>
                <span className="absolute inset-0 -z-0 rounded-full bg-emerald-400/30 blur-[6px]" />
              </span>
            </p>
          </div>
        </div>

        {/* Menú */}
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative transition-colors hover:text-slate-900"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 rounded-full bg-emerald-500 transition-all duration-200 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Botones */}
        <div className="flex items-center gap-3">
          <button className="hidden text-xs font-medium text-slate-500 hover:text-slate-900 sm:inline-flex">
            Soporte interno
          </button>
          <a
            href="/produccion" // cámbialo a donde inicie tu app
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Entrar al sistema
          </a>
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <main
        id="inicio"
        className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16 sm:pb-24"
      >
        {/* HERO PRINCIPAL */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              ● Sistema interno
            </span>

            <h1 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">
              Sistema de información{" "}
              <span className="relative inline-block">
                PEX
                <span className="absolute inset-x-0 bottom-0 h-2 rounded-full bg-emerald-200/70" />
              </span>{" "}
              para Ventas, Logística, Producción y Almacenes.
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-600">
              Un solo lugar para crear pedidos, coordinar despachos, generar
              órdenes de trabajo y controlar inventarios conectados con Google
              Sheets. Diseñado a la medida de los procesos de extrusión de GR.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/produccion"
                className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Entrar al sistema
              </a>
              <a
                href="#modulos"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Ver módulos
              </a>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                Integrado con Google Sheets
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                Procesos de corte y extrusión
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                Hecho a la medida de GR
              </span>
            </div>
          </div>

          {/* Tarjeta resumen del sistema */}
          <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Resumen del sistema
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">Pedidos</p>
                  <p className="text-[11px] text-slate-500">
                    Creación de pedidos comerciales y seguimiento.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-sky-600">
                  Ventas
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">OT de Corte</p>
                  <p className="text-[11px] text-slate-500">
                    Generación automática de órdenes de trabajo.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Producción
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">Inventarios</p>
                  <p className="text-[11px] text-slate-500">
                    Movimientos controlados por Kardex central.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-amber-600">
                  Almacenes
                </span>
              </div>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Todo conectado con la información que ya manejan en tus hojas de
              cálculo, pero con una interfaz mucho más cómoda para el equipo.
            </p>
          </aside>
        </section>

        {/* AQUÍ puedes pegar tus secciones de módulos, flujo de información, etc. */}
        {/* <section id="modulos">...</section> */}
      </main>
    </div>
  );
}


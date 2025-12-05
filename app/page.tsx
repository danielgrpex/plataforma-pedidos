// app/page.tsx
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Barra superior */}
      <header className="border-b border-slate-200 bg-white">
        {/* Línea de color muy sutil arriba */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-sky-400 to-violet-500" />

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Marca */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-sm">
              GR
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Industrias Plásticas
              </span>
              <span className="text-sm font-semibold text-slate-900">
                Sistema de información PEX
              </span>
            </div>
          </div>

          {/* Navegación */}
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link href="/" className="text-slate-900">
              Inicio
            </Link>
            <Link href="/ventas" className="hover:text-slate-900">
              Comercial
            </Link>
            <Link href="/planeacion" className="hover:text-slate-900">
              Planeación
            </Link>
            <Link href="/produccion" className="hover:text-slate-900">
              Producción
            </Link>
            <Link href="/almacen" className="hover:text-slate-900">
              Almacén
            </Link>
            <Link
              href="/soporte"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Soporte interno
            </Link>
          </nav>

          {/* Botón entrar */}
          <div className="flex items-center gap-2">
            <Link
              href="/produccion"
              className="hidden rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 md:inline-flex"
            >
              Entrar al sistema
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
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
                Un solo lugar para crear pedidos, coordinar despachos, generar
                órdenes de trabajo y producción, controlar inventarios conectados con Google
                Sheets. Diseñado a la medida de los procesos de extrusión de GR.
              </p>
            </div>

            {/* Botones */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/produccion"
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Entrar al sistema
              </Link>
              <a
                href="#modulos"
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Ver módulos
              </a>
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
                etiqueta="Almacenes"
                color="text-amber-600 bg-amber-50"
              />
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Todo conectado con la información que ya manejan en sus hojas de
              cálculo, pero con una interfaz mucho más cómoda para el equipo.
            </p>
          </div>
        </section>

        {/* Módulos */}
        <section id="modulos" className="mt-16 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Módulos del sistema
            </h2>
            <p className="text-xs text-slate-500">
              Cada área tiene su propio espacio, pero todos comparten la misma
              información de fondo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ModuloCard
              sigla="CO"
              titulo="Comercial"
              descripcion="Registro de pedidos, condiciones comerciales y estado de cada solicitud."
              estado="Activo"
            />
            <ModuloCard
              sigla="PL"
              titulo="Planeación"
              descripcion="Verificación y clasificación item por item de cada pedido."
              estado="Activo"
            />
            <ModuloCard
              sigla="PR"
              titulo="Producción"
              descripcion="Generación de órdenes de corte y extrusión."
              estado="En construcción"
            />
            <ModuloCard
              sigla="AL"
              titulo="Almacenes"
              descripcion="Inventarios de MP, producto en proceso y producto terminado."
              estado="En construcción"
            />
            <ModuloCard
              sigla="LG"
              titulo="Logística"
              descripcion="Programación de despachos, facturación y seguimiento de entregas."
              estado="En construcción"
            />
          </div>
        </section>

        {/* Flujo de información */}
        <section className="mt-16 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Cómo fluye la información
            </h2>
            <p className="text-xs text-slate-500">
              Desde comercial se alimenta la información y termina en el despacho de cada producto, sin
              volver a digitar la información.
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
              descripcion="Programa lineas de producción y generan las órdenes de corte y extrusión."
            />
            <PasoCard
              numero="04"
              titulo="Almacenes"
              descripcion="Recibe, controla inventario y se alimentan los análisis para el resto del sistema."
            />
            <PasoCard
              numero="05"
              titulo="Logística"
              descripcion="Factura, programa despachos y hace seguimiento de entrega al cliente."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

/* =========================
   Componentes pequeños
   ========================= */

function ResumenItem({
  titulo,
  descripcion,
  etiqueta,
  color,
}: {
  titulo: string;
  descripcion: string;
  etiqueta: string;
  color: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div>
        <p className="text-xs font-semibold text-slate-800">{titulo}</p>
        <p className="text-[11px] text-slate-500">{descripcion}</p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}
      >
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
}: {
  sigla: string;
  titulo: string;
  descripcion: string;
  estado: string;
}) {
  const esProduccion = estado === "Activo";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
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
            (esProduccion
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          {estado}
        </span>
      </div>

      <Link
        href={
          titulo === "Comercial"
            ? "/comercial"
            : titulo === "Planeación"
            ? "/planeacion"
            : titulo === "Producción"
            ? "/produccion"
            : titulo === "Logística"
            ? "/logistica"
            : "/almacen"
        }
        className="mt-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
      >
        Ir al módulo →
      </Link>
    </div>
  );
}

function PasoCard({
  numero,
  titulo,
  descripcion,
}: {
  numero: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">
          PASO {numero}
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-900">{titulo}</p>
        <p className="mt-1 text-[11px] text-slate-500">{descripcion}</p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Manifest = {
  id: string;
  manifest_date: string;
  carrier: string;
  file_path: string;
  file_url: string;
  uploaded_by: string;
  notes?: string;
  created_at: string;
};

type ProgramadoDia = {
  posicion: number;
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  estadoSecuencia: string;
  fechaEstimadaDespacho: string;
  fechaRealDespacho: string;
  estadoCumplimiento:
    | "despachado_dia"
    | "despachado_despues"
    | "despachado_antes"
    | "pendiente"
    | "despachado_sin_fecha";
};

type DespachadoReal = {
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  estadoPedido: string;
  fechaProgramada: string;
  fechaRealDespacho: string;
  unidadesDespachadas: number;
  registros: number;
  usuario: string;
  transporte: string;
  guia: string;
  factura: string;
  remision: string;
  tipo: "programado_dia" | "represado" | "adelantado" | "sin_programacion";
};

type ReporteDiario = {
  success: boolean;
  fecha: string;
  resumen: {
    programadosDia: number;
    despachadosRealesDia: number;
    despachadosProgramadosDia: number;
    despachadosRepresados: number;
    despachadosAdelantados: number;
    despachadosSinProgramacion: number;
    noDespachadosDelPlanDia: number;
    cumplimiento: number;
  };
  programados: ProgramadoDia[];
  despachadosReales: DespachadoReal[];
  pendientesProgramacionDia: ProgramadoDia[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowLabel() {
  return new Date().toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";

  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString("es-CO", {
    maximumFractionDigits: 0,
  });
}

function cumplimientoLabel(value: ProgramadoDia["estadoCumplimiento"]) {
  if (value === "despachado_dia") return "Despachado ese día";
  if (value === "despachado_despues") return "Despachado después";
  if (value === "despachado_antes") return "Despachado antes";
  if (value === "despachado_sin_fecha") return "Despachado";
  return "Pendiente";
}

function cumplimientoClass(value: ProgramadoDia["estadoCumplimiento"]) {
  if (value === "despachado_dia") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "despachado_despues") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "despachado_antes") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value === "despachado_sin_fecha") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function tipoDespachoLabel(value: DespachadoReal["tipo"]) {
  if (value === "programado_dia") return "Programado del día";
  if (value === "represado") return "Represado";
  if (value === "adelantado") return "Adelantado";
  return "Sin programación";
}

function tipoDespachoClass(value: DespachadoReal["tipo"]) {
  if (value === "programado_dia") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "represado") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (value === "adelantado") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ComercialTurneroDespachosPage() {
  const [fecha, setFecha] = useState(todayISO());
  const [reporte, setReporte] = useState<ReporteDiario | null>(null);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [message, setMessage] = useState("");

  async function cargar(fechaConsulta = fecha) {
    setLoading(true);
    setMessage("");

    try {
      const [repRes, manRes] = await Promise.all([
        fetch(`/api/comercial/despachos-diarios?fecha=${encodeURIComponent(fechaConsulta)}`, {
          cache: "no-store",
        }),
        fetch(`/api/logistica/manifiestos?fecha=${encodeURIComponent(fechaConsulta)}`, {
          cache: "no-store",
        }),
      ]);

      const repData = await repRes.json();
      const manData = await manRes.json();

      if (!repRes.ok || !repData.success) {
        throw new Error(repData.message || "No se pudo cargar el resumen diario.");
      }

      setReporte(repData as ReporteDiario);

      if (manData.success) {
        setManifests(manData.manifests || []);
      } else {
        setManifests([]);
      }

      setUpdatedAt(nowLabel());
    } catch (err: any) {
      setMessage(err?.message || "Error cargando información.");
      setReporte(null);
      setManifests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar(fecha);

    let intervalId: number | undefined;

    const ahora = new Date();
    const siguienteHora = new Date(ahora);
    siguienteHora.setHours(ahora.getHours() + 1, 0, 0, 0);

    const espera = siguienteHora.getTime() - ahora.getTime();

    const timeoutId = window.setTimeout(() => {
      cargar(fecha);

      intervalId = window.setInterval(() => {
        cargar(fecha);
      }, 60 * 60 * 1000);
    }, espera);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const resumen = reporte?.resumen;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            Comercial
          </span>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Control diario de despachos
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Consulta qué estaba programado para el día y qué se despachó realmente.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-100">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Actualizado
            </span>

            <span className="text-xs text-slate-500">
              {updatedAt ? `Última actualización: ${updatedAt}` : "Cargando información..."}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value || todayISO())}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          />

          <button
            onClick={() => cargar(fecha)}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Refrescar"}
          </button>

          <Link
            href="/comercial"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            ← Comercial
          </Link>
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Programados
          </div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {resumen?.programadosDia ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Para {formatFecha(fecha)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-emerald-700">
            Despachados reales
          </div>
          <div className="mt-2 text-3xl font-semibold text-emerald-800">
            {resumen?.despachadosRealesDia ?? 0}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            Salieron ese día
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-blue-700">
            Del plan
          </div>
          <div className="mt-2 text-3xl font-semibold text-blue-800">
            {resumen?.despachadosProgramadosDia ?? 0}
          </div>
          <div className="mt-1 text-xs text-blue-700">
            Programados y despachados ese día
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-orange-700">
            Represados
          </div>
          <div className="mt-2 text-3xl font-semibold text-orange-800">
            {resumen?.despachadosRepresados ?? 0}
          </div>
          <div className="mt-1 text-xs text-orange-700">
            Salieron con atraso
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-red-700">
            No salieron del plan
          </div>
          <div className="mt-2 text-3xl font-semibold text-red-800">
            {resumen?.noDespachadosDelPlanDia ?? 0}
          </div>
          <div className="mt-1 text-xs text-red-700">
            Pendientes o salieron después
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Cumplimiento
          </div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {resumen?.cumplimiento ?? 0}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Del plan del día
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Programación del día
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Pedidos programados para {formatFecha(fecha)}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Esta lista no desaparece aunque logística ya haya despachado.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-5 py-3 text-center ring-1 ring-slate-100">
                <div className="text-xs font-medium text-slate-500">Programados</div>
                <div className="text-2xl font-semibold text-slate-800">
                  {reporte?.programados?.length ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {!reporte?.programados?.length && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No hay pedidos programados para esta fecha.
                </div>
              )}

              {reporte?.programados?.map((s, idx) => (
                <div key={`${idx}-${s.pedidosKey}`} className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-slate-900">
                      {s.cliente || s.pedidosKey}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Dirección: {s.direccion || "-"}
                    </div>

                    <div className="text-sm text-slate-600">OC: {s.oc || "-"}</div>

                    {s.fechaRealDespacho ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Fecha real despacho: {formatFecha(s.fechaRealDespacho)}
                      </div>
                    ) : null}
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${cumplimientoClass(
                      s.estadoCumplimiento
                    )}`}
                  >
                    {cumplimientoLabel(s.estadoCumplimiento)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Despachos reales
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Lo que realmente salió el {formatFecha(fecha)}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Incluye pedidos del día, represados, adelantados o sin programación.
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-center ring-1 ring-emerald-100">
                <div className="text-xs font-medium text-emerald-700">Despachados</div>
                <div className="text-2xl font-semibold text-emerald-800">
                  {reporte?.despachadosReales?.length ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {!reporte?.despachadosReales?.length && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No hay despachos registrados para esta fecha.
                </div>
              )}

              {reporte?.despachadosReales?.map((d, idx) => (
                <div key={`${idx}-${d.pedidosKey}`} className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-slate-900">
                      {d.cliente || d.pedidosKey}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Dirección: {d.direccion || "-"}
                    </div>

                    <div className="text-sm text-slate-600">OC: {d.oc || "-"}</div>

                    <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                      <div>Programado para: {d.fechaProgramada ? formatFecha(d.fechaProgramada) : "Sin programación"}</div>
                      <div>Unidades: {formatNumber(d.unidadesDespachadas)}</div>
                      <div>Transporte: {d.transporte || "-"}</div>
                      <div>Guía: {d.guia || "-"}</div>
                      <div>Remisión: {d.remision || "-"}</div>
                      <div>Usuario: {d.usuario || "-"}</div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${tipoDespachoClass(
                      d.tipo
                    )}`}
                  >
                    {tipoDespachoLabel(d.tipo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  No despachados según programación
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Pedidos programados para {formatFecha(fecha)} que no salieron ese día
                </h2>
              </div>

              <div className="rounded-2xl bg-white px-5 py-3 text-center ring-1 ring-amber-100">
                <div className="text-xs font-medium text-amber-700">Pendientes</div>
                <div className="text-2xl font-semibold text-amber-800">
                  {reporte?.pendientesProgramacionDia?.length ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-amber-100 rounded-2xl border border-amber-100 bg-white">
              {!reporte?.pendientesProgramacionDia?.length && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Todos los pedidos programados para este día salieron ese mismo día.
                </div>
              )}

              {reporte?.pendientesProgramacionDia?.map((p, idx) => (
                <div key={`${idx}-${p.pedidosKey}`} className="flex items-start gap-4 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">
                      {p.cliente || p.pedidosKey}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Dirección: {p.direccion || "-"} · OC: {p.oc || "-"}
                    </div>

                    {p.fechaRealDespacho ? (
                      <div className="mt-1 text-xs text-amber-700">
                        Se despachó después: {formatFecha(p.fechaRealDespacho)}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-red-700">
                        Todavía no tiene despacho registrado.
                      </div>
                    )}
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${cumplimientoClass(
                      p.estadoCumplimiento
                    )}`}
                  >
                    {cumplimientoLabel(p.estadoCumplimiento)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Manifiestos
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Archivos disponibles
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manifiestos cargados por Logística para {formatFecha(fecha)}.
            </p>

            <div className="mt-5 space-y-3">
              {manifests.length === 0 && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-100">
                  Aún no hay manifiestos cargados para esta fecha.
                </div>
              )}

              {manifests.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">
                    {m.carrier || "Transportadora"}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Subido:{" "}
                    {m.created_at ? new Date(m.created_at).toLocaleString("es-CO") : "-"}
                  </div>

                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-full justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Descargar manifiesto
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="font-semibold">Importante</div>
            <p className="mt-1">
              Esta pantalla compara la programación original del día contra los despachos reales
              registrados por Logística.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
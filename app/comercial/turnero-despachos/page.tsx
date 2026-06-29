"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Secuencia = {
  posicion: number;
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  prioridadManual: string;
  estado: string;
  programadoPor: string;
  fechaProgramacion: string;
};

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

export default function ComercialTurneroDespachosPage() {
  const [fecha, setFecha] = useState(todayISO());
  const [items, setItems] = useState<Secuencia[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  async function cargar(fechaConsulta = fecha) {
    setLoading(true);

    try {
      const [seqRes, manRes] = await Promise.all([
        fetch(`/api/planeacion/secuencia-despachos?fecha=${encodeURIComponent(fechaConsulta)}`, {
          cache: "no-store",
        }),
        fetch(`/api/logistica/manifiestos?fecha=${encodeURIComponent(fechaConsulta)}`, {
          cache: "no-store",
        }),
      ]);

      const seqData = await seqRes.json();
      const manData = await manRes.json();

      if (seqData.success) setItems(seqData.secuencia || []);
      if (manData.success) setManifests(manData.manifests || []);

      setUpdatedAt(nowLabel());
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

  const estimados = useMemo(() => items.slice(0, 10), [items]);
  const enCola = useMemo(() => items.slice(10), [items]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            Comercial
          </span>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Pantalla de turnos de despacho
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Consulta la secuencia oficial definida por Planeación y ejecutada por Logística.
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

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Despachos estimados
                </div>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  {formatFecha(fecha)}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Consolidado estimado para la fecha seleccionada.
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-center ring-1 ring-emerald-100">
                <div className="text-xs font-medium text-emerald-700">Estimados</div>
                <div className="text-2xl font-semibold text-emerald-800">
                  {estimados.length}
                </div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {estimados.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No hay despachos estimados para esta fecha.
                </div>
              )}

              {estimados.map((s, idx) => (
                <div key={`${idx + 1}-${s.pedidosKey}`} className="flex items-start gap-4 p-4">
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
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {s.estado || "Programado"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  En cola
                </div>

                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  Próximos despachos después del consolidado estimado
                </h2>
              </div>

              <div className="rounded-2xl bg-slate-50 px-5 py-3 text-center ring-1 ring-slate-100">
                <div className="text-xs font-medium text-slate-500">En cola</div>
                <div className="text-2xl font-semibold text-slate-800">{enCola.length}</div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {enCola.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No hay despachos adicionales en cola.
                </div>
              )}

              {enCola.map((s, idx) => (
                <div key={`${idx + 11}-${s.pedidosKey}`} className="flex items-start gap-4 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {idx + 11}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{s.cliente || s.pedidosKey}</div>
                    <div className="text-xs text-slate-500">
                      Dirección: {s.direccion || "-"} · OC: {s.oc || "-"}
                    </div>
                  </div>
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
              Los despachos estimados pueden cambiar según la operación diaria.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
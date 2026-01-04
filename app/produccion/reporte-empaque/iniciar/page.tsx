"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrdenCorte = {
  solicitudCorteId: string;
  pedidoKey: string;
  rowIndexPedido: number | string;
  productoSolicitado: string;
  cantidadSolicitadaUnd: number | string;
  estadoitem: string;
  usuario?: string;
  OTE?: string;
};

type Trabajador = { id: string; nombre: string };

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function IniciarReporteEmpaquePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ordenes, setOrdenes] = useState<OrdenCorte[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);

  const [ordenId, setOrdenId] = useState("");
  const [trabajadorId, setTrabajadorId] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const ordenSeleccionada = useMemo(
    () => ordenes.find((o) => o.solicitudCorteId === ordenId) ?? null,
    [ordenes, ordenId]
  );

const ordenLabel = (o: OrdenCorte) => {
  const ote = String(o.OTE ?? "").trim() || "SIN-OTE";
  const idx = String(o.rowIndexPedido ?? "").trim() || "-";
  const prod = String(o.productoSolicitado ?? "").trim();
  const und = String(o.cantidadSolicitadaUnd ?? "").trim();
  return `${ote} — ${idx} — ${prod} — ${und} UND`;
};


  const resetForm = () => {
    setOrdenId("");
    setTrabajadorId("");
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const [ords, trab] = await Promise.all([
        safeJsonFetch<OrdenCorte[]>("/api/produccion/solicitudes-corte/generadas"),
        safeJsonFetch<Trabajador[]>("/api/info/trabajadores"),
      ]);

      if (!mounted) return;

      if (!ords || !trab) {
        setLoadError("No se pudieron cargar datos. Revisa endpoints/credenciales.");
        setOrdenes([]);
        setTrabajadores([]);
        setLoading(false);
        return;
      }

      setOrdenes(ords);
      setTrabajadores(trab);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const validate = (): string | null => {
    if (!ordenId) return "Selecciona una orden (estado: Generada).";
    if (!trabajadorId) return "Selecciona el trabajador.";
    return null;
  };

  const onIniciar = async () => {
    setSubmitError(null);
    setSubmitOk(null);

    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    const trabajadorNombre =
      trabajadores.find((t) => t.id === trabajadorId)?.nombre ?? "";

    try {
      const res = await fetch("/api/produccion/reporte-empaque/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudCorteId: ordenId,
          trabajadorNombre,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error ?? "No se pudo iniciar.");
        return;
      }

      setSubmitOk("✅ Inicio Empaque registrado. Estado: En curso.");
      resetForm();

      // Recargar lista por si quieres que se mantenga igual (no cambia estadoitem aún, eso lo definimos después)
      const ords = await safeJsonFetch<OrdenCorte[]>("/api/produccion/solicitudes-corte/generadas");
      if (ords) setOrdenes(ords);
    } catch {
      setSubmitError("Error de red al iniciar.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Iniciar — Reporte Operario Empaque
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Selecciona una orden generada (OTE) y el trabajador para iniciar empaque.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/reporte-empaque")}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-xl bg-neutral-100 p-1">
                <div className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm ring-1 ring-black/5">
                  Inicio Empaque
                </div>
              </div>
              <div className="pb-3 text-xs text-neutral-500">
                {loading ? "Cargando…" : `${ordenes.length} órdenes generadas`}
              </div>
            </div>
          </div>

          <div className="p-6">
            {loadError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Orden (Generada)">
                <select
                  value={ordenId}
                  onChange={(e) => setOrdenId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {ordenes.map((o) => (
                    <option key={o.solicitudCorteId} value={o.solicitudCorteId}>
                      {ordenLabel(o)}
                    </option>
                  ))}
                </select>

                {ordenSeleccionada && (
                  <p className="mt-1 text-xs text-neutral-600">
                    ID: <span className="font-medium">{ordenSeleccionada.solicitudCorteId}</span>
                    {" "}• Pedido: <span className="font-medium">{ordenSeleccionada.pedidoKey}</span>
                  </p>
                )}
              </Field>

              <Field label="Trabajador">
                <select
                  value={trabajadorId}
                  onChange={(e) => setTrabajadorId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {trabajadores.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {submitError}
                  </div>
                )}
                {submitOk && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {submitOk}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onIniciar}
                className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-900"
                disabled={loading || !!loadError}
              >
                Iniciar
              </button>
            </div>

            <p className="mt-4 text-xs text-neutral-500">
              Nota: Después implementamos “Finalizar” para llenar Hora Fin, avance, PNC, observaciones, supervisor y marcar estado final.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-900">{label}</label>
      {children}
    </div>
  );
}

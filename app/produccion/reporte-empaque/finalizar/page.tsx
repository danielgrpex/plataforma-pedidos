"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EnCursoEq = {
  rowIndex: number;
  OTE: string;
  rowIndexPedido: string;
  productoSolicitado: string;
  Trabajador: string;
  Estado: string;
};

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const ACTIVIDADES = ["Cortar","Cortar Iman","Despestañar","Empacar","Encintar","Ensamblar","Imantar","Limpiar","Marcar","Perforar","Rebabar","Rebordear","Reempacar","Revisar","Sellar Bolsa","Troquelar","Descargue Material","Limpieza Planta","Inventario"];

export default function FinalizarReporteEmpaquePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EnCursoEq[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | "">("");

  // Campos
  const [avance, setAvance] = useState("");
  const [pncUnd, setPncUnd] = useState("");
  const [pncKg, setPncKg] = useState("");
  const [observacionesEmpaque, setObservacionesEmpaque] = useState("");
  const [supervisor, setSupervisor] = useState("");

  // Actividades realizadas (chips)
  const [actividades, setActividades] = useState<string[]>([]);

  // UX
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((x) => x.rowIndex === selectedRowIndex) ?? null,
    [items, selectedRowIndex]
  );

  const labelItem = (it: EnCursoEq) =>
    `${it.OTE} — ${it.Trabajador} — ${it.productoSolicitado}`;

  const resetForm = () => {
    setSelectedRowIndex("");
    setAvance("");
    setPncUnd("");
    setPncKg("");
    setObservacionesEmpaque("");
    setSupervisor("");
    setActividades([]);
  };

  const toggleActividad = (act: string) => {
    setActividades((prev) =>
      prev.includes(act) ? prev.filter((x) => x !== act) : [...prev, act]
    );
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setSubmitError(null);
      setSubmitOk(null);
      setSelectedRowIndex("");

      const data = await safeJsonFetch<EnCursoEq[]>(
        "/api/produccion/reporte-empaque/en-curso"
      );

      if (!mounted) return;

      if (!data) {
        setLoadError("No se pudo cargar el listado. Revisa el endpoint.");
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(data);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const validate = (): string | null => {
    if (!selectedRowIndex) return "Selecciona una orden en curso.";
    if (actividades.length === 0)
      return "Selecciona al menos una actividad realizada.";
    return null;
  };

  const onFinalizar = async () => {
    setSubmitError(null);
    setSubmitOk(null);

    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    try {
      const res = await fetch("/api/produccion/reporte-empaque/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: selectedRowIndex,
          data: {
            avance,
            pncUnd,
            pncKg,
            observacionesEmpaque,
            supervisor,
            actividades, // 👈 array, backend lo convierte a "a, b, c"
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error ?? "No se pudo finalizar.");
        return;
      }

      setSubmitOk("✅ Finalizado. Se actualizó Hora Fin y Estado = Finalizado.");
      resetForm();

      // Recargar lista para que desaparezca del dropdown
      const updated = await safeJsonFetch<EnCursoEq[]>(
        "/api/produccion/reporte-empaque/en-curso"
      );
      setItems(updated ?? []);
    } catch {
      setSubmitError("Error de red al finalizar.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Finalizar — Reporte Operario Empaque
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Selecciona una orden en curso y completa el cierre.
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
                  Finalizar Empaque
                </div>
              </div>
              <div className="pb-3 text-xs text-neutral-500">
                {loading ? "Cargando…" : `${items.length} órdenes en curso`}
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
              <Field label="Orden en curso">
                <select
                  value={selectedRowIndex}
                  onChange={(e) =>
                    setSelectedRowIndex(e.target.value ? Number(e.target.value) : "")
                  }
                  className={inputCls}
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {items.map((it) => (
                    <option key={it.rowIndex} value={it.rowIndex}>
                      {labelItem(it)}
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <p className="mt-1 text-xs text-neutral-600">
                    OTE: <span className="font-medium">{selectedItem.OTE}</span> •
                    Row: <span className="font-medium">{selectedItem.rowIndexPedido}</span>
                  </p>
                )}
              </Field>

              <div className="hidden md:block" />
            </div>

            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Actividades Realizadas
                </p>
                <p className="text-xs text-neutral-600">
                  Selecciona una o varias. Se guardan en <span className="font-medium">Actividad</span> separadas por coma.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {ACTIVIDADES.map((act) => {
                    const active = actividades.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleActividad(act)}
                        className={[
                          "rounded-full px-3 py-1 text-sm transition border",
                          active
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        {act}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Avance">
                  <input value={avance} onChange={(e) => setAvance(e.target.value)} className={inputCls} />
                </Field>
                <Field label="PNC (UND)">
                  <input value={pncUnd} onChange={(e) => setPncUnd(e.target.value)} className={inputCls} />
                </Field>
                <Field label="PNC (Kg)">
                  <input value={pncKg} onChange={(e) => setPncKg(e.target.value)} className={inputCls} />
                </Field>
              </div>

              <Field label="Observaciones Empaque">
                <textarea
                  value={observacionesEmpaque}
                  onChange={(e) => setObservacionesEmpaque(e.target.value)}
                  className="min-h-[90px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  placeholder="Escribe observaciones…"
                />
              </Field>

              <Field label="Supervisor">
                <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={inputCls} />
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
                onClick={onFinalizar}
                className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-900"
                disabled={loading || !!loadError}
              >
                Finalizar
              </button>
            </div>

            <p className="mt-4 text-xs text-neutral-500">
              Nota: Hora Fin y Estado se actualizan automáticamente al finalizar.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-900">{label}</label>
      {children}
    </div>
  );
}

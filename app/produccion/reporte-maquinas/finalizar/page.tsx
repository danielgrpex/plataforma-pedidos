// app/produccion/reporte-maquinas/finalizar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "alistamiento" | "cuadre" | "produccion";

type EnCursoItem = {
  rowIndex: number;
  Timestamp: string;
  OPE: string;
  productoKey: string;
  Trabajador: string;
  Actividad: string;
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

export default function FinalizarReporteMaquinasPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("alistamiento");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EnCursoItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | "">("");

  // --- Campos Alistamiento
  const [obsAlist, setObsAlist] = useState("");

  // --- Campos Cuadre (21 + observaciones)
  const [pncCuadreKg, setPncCuadreKg] = useState("");
  const [tz1mq1, setTz1mq1] = useState("");
  const [tz2mq1, setTz2mq1] = useState("");
  const [tz3mq1, setTz3mq1] = useState("");
  const [tczmq1, setTczmq1] = useState("");
  const [tbqmq1, setTbqmq1] = useState("");
  const [fremq1, setFremq1] = useState("");

  const [tz1mq2, setTz1mq2] = useState("");
  const [tz2mq2, setTz2mq2] = useState("");
  const [tz3mq2, setTz3mq2] = useState("");
  const [tczmq2, setTczmq2] = useState("");
  const [tbqmq2, setTbqmq2] = useState("");
  const [fremq2, setFremq2] = useState("");

  const [tz1mq3, setTz1mq3] = useState("");
  const [tz2mq3, setTz2mq3] = useState("");
  const [tz3mq3, setTz3mq3] = useState("");
  const [tczmq3, setTczmq3] = useState("");
  const [tbqmq3, setTbqmq3] = useState("");
  const [fremq3, setFremq3] = useState("");

  const [frehal, setFrehal] = useState("");
  const [obsCuadre, setObsCuadre] = useState("");

  // --- Campos Producción (8 + observaciones)
  const [avance, setAvance] = useState("");
  const [pesoReal, setPesoReal] = useState("");
  const [cicloReal, setCicloReal] = useState("");
  const [pncUnd, setPncUnd] = useState("");
  const [pncKg, setPncKg] = useState("");
  const [tiempoParoH, setTiempoParoH] = useState("");
  const [tipoParo, setTipoParo] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [obsProd, setObsProd] = useState("");

  // UX
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const tipoApi = useMemo(() => {
    if (tab === "alistamiento") return "alistamiento";
    if (tab === "cuadre") return "cuadre";
    return "produccion";
  }, [tab]);

  const labelItem = (it: EnCursoItem) =>
    `${it.OPE} — ${it.Trabajador} — ${it.productoKey}`;

  const resetForm = () => {
    setSelectedRowIndex("");
    setObsAlist("");

    setPncCuadreKg("");
    setTz1mq1(""); setTz2mq1(""); setTz3mq1(""); setTczmq1(""); setTbqmq1(""); setFremq1("");
    setTz1mq2(""); setTz2mq2(""); setTz3mq2(""); setTczmq2(""); setTbqmq2(""); setFremq2("");
    setTz1mq3(""); setTz2mq3(""); setTz3mq3(""); setTczmq3(""); setTbqmq3(""); setFremq3("");
    setFrehal("");
    setObsCuadre("");

    setAvance("");
    setPesoReal("");
    setCicloReal("");
    setPncUnd("");
    setPncKg("");
    setTiempoParoH("");
    setTipoParo("");
    setSupervisor("");
    setObsProd("");
  };

  // Cargar listado por pestaña
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setSubmitError(null);
      setSubmitOk(null);
      setSelectedRowIndex("");

      const data = await safeJsonFetch<EnCursoItem[]>(
        `/api/produccion/reporte-maquinas/en-curso?tipo=${tipoApi}`
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
  }, [tipoApi]);

  const validate = (): string | null => {
    if (!selectedRowIndex) return "Selecciona una orden en curso.";

    if (tab === "alistamiento") {
      // Observaciones opcional (si la quieres obligatoria, lo cambiamos)
      return null;
    }

    if (tab === "cuadre") {
      // aquí podrías obligar algunos, por ahora dejamos libre
      return null;
    }

    if (tab === "produccion") {
      return null;
    }

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

    const data: any = {};

    if (tab === "alistamiento") {
      data.observacionesAlistamiento = obsAlist;
    }

    if (tab === "cuadre") {
      Object.assign(data, {
        pncCuadreKg,
        tz1mq1, tz2mq1, tz3mq1, tczmq1, tbqmq1, fremq1,
        tz1mq2, tz2mq2, tz3mq2, tczmq2, tbqmq2, fremq2,
        tz1mq3, tz2mq3, tz3mq3, tczmq3, tbqmq3, fremq3,
        frehal,
        observacionesCuadre: obsCuadre,
      });
    }

    if (tab === "produccion") {
      Object.assign(data, {
        avance,
        pesoReal,
        cicloReal,
        pncUnd,
        pncKg,
        tiempoParoH,
        tipoParo,
        supervisor,
        observacionesProduccion: obsProd,
      });
    }

    try {
      const res = await fetch("/api/produccion/reporte-maquinas/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoApi,
          rowIndex: selectedRowIndex,
          data,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error ?? "No se pudo finalizar.");
        return;
      }

      setSubmitOk("✅ Finalizado. Se actualizó Hora Fin y se marcó Estado = Finalizado.");
      resetForm();

      // Recargar listado (para que desaparezca del dropdown)
      const updated = await safeJsonFetch<EnCursoItem[]>(
        `/api/produccion/reporte-maquinas/en-curso?tipo=${tipoApi}`
      );
      setItems(updated ?? []);
    } catch {
      setSubmitError("Error de red al finalizar.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Finalizar — Registro Operativo Máquinas
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Selecciona una orden en curso y completa el cierre según la etapa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/reporte-maquinas")}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {/* Tabs */}
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-xl bg-neutral-100 p-1">
                <TabButton active={tab === "alistamiento"} onClick={() => setTab("alistamiento")}>
                  Alistamiento Herramental
                </TabButton>
                <TabButton active={tab === "cuadre"} onClick={() => setTab("cuadre")}>
                  Cuadre de Linea
                </TabButton>
                <TabButton active={tab === "produccion"} onClick={() => setTab("produccion")}>
                  Producción
                </TabButton>
              </div>

              <div className="pb-3 text-xs text-neutral-500 sm:pb-0">
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
                  onChange={(e) => setSelectedRowIndex(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {items.map((it) => (
                    <option key={it.rowIndex} value={it.rowIndex}>
                      {labelItem(it)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-600">
                  Fuente: <span className="font-medium">ReporteOperarioMq</span> (Actividad + Estado en curso)
                </p>
              </Field>

              <div className="hidden md:block" />
            </div>

            {/* Campos por tab */}
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              {tab === "alistamiento" && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-neutral-900">
                    Cierre — Alistamiento Herramental
                  </p>
                  <Field label="Observaciones Alistamiento">
                    <textarea
                      value={obsAlist}
                      onChange={(e) => setObsAlist(e.target.value)}
                      className="min-h-[90px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      placeholder="Escribe observaciones…"
                      disabled={!!loadError}
                    />
                  </Field>
                </div>
              )}

              {tab === "cuadre" && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-neutral-900">
                    Cierre — Cuadre de Linea
                  </p>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="PNC Cuadre (Kg)">
                      <input value={pncCuadreKg} onChange={(e) => setPncCuadreKg(e.target.value)} className={inputCls} />
                    </Field>

                    <div className="md:col-span-3 mt-2 text-xs font-medium text-neutral-700">Máquina 1</div>
                    <Field label="TZ1 MQ1"><input value={tz1mq1} onChange={(e) => setTz1mq1(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ2 MQ1"><input value={tz2mq1} onChange={(e) => setTz2mq1(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ3 MQ1"><input value={tz3mq1} onChange={(e) => setTz3mq1(e.target.value)} className={inputCls} /></Field>
                    <Field label="TCZ MQ1"><input value={tczmq1} onChange={(e) => setTczmq1(e.target.value)} className={inputCls} /></Field>
                    <Field label="TBQ MQ1"><input value={tbqmq1} onChange={(e) => setTbqmq1(e.target.value)} className={inputCls} /></Field>
                    <Field label="FRE MQ1"><input value={fremq1} onChange={(e) => setFremq1(e.target.value)} className={inputCls} /></Field>

                    <div className="md:col-span-3 mt-2 text-xs font-medium text-neutral-700">Máquina 2</div>
                    <Field label="TZ1 MQ2"><input value={tz1mq2} onChange={(e) => setTz1mq2(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ2 MQ2"><input value={tz2mq2} onChange={(e) => setTz2mq2(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ3 MQ2"><input value={tz3mq2} onChange={(e) => setTz3mq2(e.target.value)} className={inputCls} /></Field>
                    <Field label="TCZ MQ2"><input value={tczmq2} onChange={(e) => setTczmq2(e.target.value)} className={inputCls} /></Field>
                    <Field label="TBQ MQ2"><input value={tbqmq2} onChange={(e) => setTbqmq2(e.target.value)} className={inputCls} /></Field>
                    <Field label="FRE MQ2"><input value={fremq2} onChange={(e) => setFremq2(e.target.value)} className={inputCls} /></Field>

                    <div className="md:col-span-3 mt-2 text-xs font-medium text-neutral-700">Máquina 3</div>
                    <Field label="TZ1 MQ3"><input value={tz1mq3} onChange={(e) => setTz1mq3(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ2 MQ3"><input value={tz2mq3} onChange={(e) => setTz2mq3(e.target.value)} className={inputCls} /></Field>
                    <Field label="TZ3 MQ3"><input value={tz3mq3} onChange={(e) => setTz3mq3(e.target.value)} className={inputCls} /></Field>
                    <Field label="TCZ MQ3"><input value={tczmq3} onChange={(e) => setTczmq3(e.target.value)} className={inputCls} /></Field>
                    <Field label="TBQ MQ3"><input value={tbqmq3} onChange={(e) => setTbqmq3(e.target.value)} className={inputCls} /></Field>
                    <Field label="FRE MQ3"><input value={fremq3} onChange={(e) => setFremq3(e.target.value)} className={inputCls} /></Field>

                    <Field label="FRE Halador">
                      <input value={frehal} onChange={(e) => setFrehal(e.target.value)} className={inputCls} />
                    </Field>
                  </div>

                  <Field label="Observaciones Cuadre">
                    <textarea
                      value={obsCuadre}
                      onChange={(e) => setObsCuadre(e.target.value)}
                      className="min-h-[90px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      placeholder="Escribe observaciones…"
                    />
                  </Field>
                </div>
              )}

              {tab === "produccion" && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-neutral-900">
                    Cierre — Producción
                  </p>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Avance"><input value={avance} onChange={(e) => setAvance(e.target.value)} className={inputCls} /></Field>
                    <Field label="Peso Real"><input value={pesoReal} onChange={(e) => setPesoReal(e.target.value)} className={inputCls} /></Field>
                    <Field label="Ciclo Real"><input value={cicloReal} onChange={(e) => setCicloReal(e.target.value)} className={inputCls} /></Field>

                    <Field label="PNC (UND)"><input value={pncUnd} onChange={(e) => setPncUnd(e.target.value)} className={inputCls} /></Field>
                    <Field label="PNC (Kg)"><input value={pncKg} onChange={(e) => setPncKg(e.target.value)} className={inputCls} /></Field>
                    <Field label="Tiempo Paro (h)"><input value={tiempoParoH} onChange={(e) => setTiempoParoH(e.target.value)} className={inputCls} /></Field>

                    <Field label="Tipo Paro"><input value={tipoParo} onChange={(e) => setTipoParo(e.target.value)} className={inputCls} /></Field>
                    <Field label="Supervisor"><input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={inputCls} /></Field>
                  </div>

                  <Field label="Observaciones Producción">
                    <textarea
                      value={obsProd}
                      onChange={(e) => setObsProd(e.target.value)}
                      className="min-h-[90px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      placeholder="Escribe observaciones…"
                    />
                  </Field>

                  <p className="text-xs text-neutral-500">
                    Nota: Si tu hoja no tiene columna <span className="font-medium">Observaciones Producción</span>, igual se finaliza sin problema.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
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
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap",
        active
          ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
          : "text-neutral-600 hover:text-neutral-900",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children}
    </div>
  );
}

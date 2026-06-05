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

type OrdenResumen = {
  ope: string;
  pedidoKey: string;
  rowIndexPedido: string;
  productoKey: string;
  cantidadUND: number;
  avanceActual: number;
  faltante: number;
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

// ✅ Validadores
function sanitizeInt(v: string) {
  return v.replace(/[^\d]/g, ""); // solo dígitos
}
function sanitizeDecimal(v: string) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const parts = s.split(".");
  if (parts.length <= 1) return s;
  return parts[0] + "." + parts.slice(1).join(""); // solo 1 punto
}

export default function FinalizarReporteMaquinasPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("alistamiento");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EnCursoItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paros, setParos] = useState<string[]>([]);
  const [supervisores, setSupervisores] = useState<string[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | "">("");

  // ✅ resumen orden
  const [ordenInfo, setOrdenInfo] = useState<OrdenResumen | null>(null);
  const [loadingOrden, setLoadingOrden] = useState(false);

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
  const [horasParo, setHorasParo] = useState("0");
const [minutosParo, setMinutosParo] = useState("0");
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

  const labelItem = (it: EnCursoItem) => `${it.OPE} — ${it.Trabajador} — ${it.productoKey}`;

  useEffect(() => {
  let mounted = true;

  async function loadCatalogos() {
    const data = await safeJsonFetch<{
      ok: boolean;
      data: {
        paros: string[];
        supervisores: string[];
      };
    }>("/api/produccion/catalogos/reporte-maquinas");

    if (!mounted) return;

    if (data?.ok) {
  setParos(data.data.paros || []);
  setSupervisores(data.data.supervisores || []);
}
  }

  loadCatalogos();

  return () => {
    mounted = false;
  };
}, []);

  const resetForm = () => {
    setSelectedRowIndex("");
    setOrdenInfo(null);

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
setHorasParo("0");
setMinutosParo("0");
    setTipoParo("");
    setSupervisor("");
    setObsProd("");
  };

  // ✅ Cargar resumen cuando se selecciona orden
  async function loadOrdenInfoFromItem(it: EnCursoItem) {
    setLoadingOrden(true);
    try {
      const res = await fetch(
        `/api/produccion/ordenes/detalle?ope=${encodeURIComponent(it.OPE)}&productoKey=${encodeURIComponent(it.productoKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message || "No se pudo cargar detalle");
      setOrdenInfo(json.orden as OrdenResumen);
    } catch (e: any) {
      setOrdenInfo(null);
      alert(e?.message || "Error cargando detalle de la orden");
    } finally {
      setLoadingOrden(false);
    }
  }

  // Cargar listado por pestaña
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setSubmitError(null);
      setSubmitOk(null);
      setSelectedRowIndex("");
      setOrdenInfo(null);

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
    return () => { mounted = false; };
  }, [tipoApi]);

  const validate = (): string | null => {
    if (!selectedRowIndex) return "Selecciona una orden en curso.";
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
  tiempoParoH: tiempoParoCalculado,
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

      // Recargar listado
      const updated = await safeJsonFetch<EnCursoItem[]>(
        `/api/produccion/reporte-maquinas/en-curso?tipo=${tipoApi}`
      );
      setItems(updated ?? []);
    } catch {
      setSubmitError("Error de red al finalizar.");
    }
  };
const tiempoParoCalculado = useMemo(() => {
  const horas = Number(horasParo || 0);
  const minutos = Number(minutosParo || 0);

  const total = horas + minutos / 60;

  return total.toFixed(2);
}, [horasParo, minutosParo]);
  const selectedItem = useMemo(() => {
    if (!selectedRowIndex) return null;
    return items.find((x) => x.rowIndex === selectedRowIndex) || null;
  }, [selectedRowIndex, items]);

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
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setSelectedRowIndex(v);
                    setOrdenInfo(null);
                    if (v) {
                      const it = items.find((x) => x.rowIndex === v);
                      if (it) loadOrdenInfoFromItem(it);
                    }
                  }}
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

            {/* ✅ Resumen al seleccionar */}
            {selectedItem && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Resumen de la orden seleccionada
                  </h3>
                  {loadingOrden && <span className="text-xs text-neutral-500">Cargando…</span>}
                </div>

                {!loadingOrden && ordenInfo && (
                  <div className="mt-3 grid gap-2 text-sm">
                    <Row label="OPE" value={ordenInfo.ope} />
                    <Row label="pedidoKey" value={ordenInfo.pedidoKey || "—"} />
                    <Row label="rowIndexPedido" value={ordenInfo.rowIndexPedido || "—"} />
                    <Row label="productoKey" value={ordenInfo.productoKey || "—"} />
                    <Row label="Cantidad solicitada (UND)" value={String(ordenInfo.cantidadUND ?? 0)} />

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Kpi title="Unidades acumuladas" value={String(ordenInfo.avanceActual ?? 0)} />
                      <Kpi title="Unidades faltantes" value={String(ordenInfo.faltante ?? 0)} />
                    </div>
                  </div>
                )}

                {!loadingOrden && !ordenInfo && (
                  <div className="mt-2 text-sm text-neutral-600">
                    No se pudo cargar el resumen de esta orden.
                  </div>
                )}
              </div>
            )}

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
                  <p className="text-sm font-medium text-neutral-900">Cierre — Producción</p>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Avance">
                      <input
                        inputMode="numeric"
                        pattern="\d*"
                        value={avance}
                        onChange={(e) => setAvance(sanitizeInt(e.target.value))}
                        className={inputCls}
                        placeholder="Digite las unidades que avanzó en el turno"
                      />
                      <p className="mt-1 text-xs text-neutral-600">Digite las unidades que avanzó en el turno</p>
                    </Field>

                    <Field label="Peso Real">
                      <input
                        inputMode="decimal"
                        value={pesoReal}
                        onChange={(e) => setPesoReal(sanitizeDecimal(e.target.value))}
                        className={inputCls}
                        placeholder="Digite el peso por metro en gramos"
                      />
                      <p className="mt-1 text-xs text-neutral-600">Digite el peso por metro en gramos</p>
                    </Field>

                    <Field label="Ciclo Real">
                      <input
                        inputMode="decimal"
                        value={cicloReal}
                        onChange={(e) => setCicloReal(sanitizeDecimal(e.target.value))}
                        className={inputCls}
                        placeholder="Digite el ciclo por metro en segundos"
                      />
                      <p className="mt-1 text-xs text-neutral-600">Digite el ciclo por metro en segundos</p>
                    </Field>

                    <Field label="PNC (UND)">
                      <input
                        inputMode="numeric"
                        pattern="\d*"
                        value={pncUnd}
                        onChange={(e) => setPncUnd(sanitizeInt(e.target.value))}
                        className={inputCls}
                        placeholder="Digite las unidades de producto no conforme"
                      />
                      <p className="mt-1 text-xs text-neutral-600">Digite las unidades de producto no conforme</p>
                    </Field>

                    <Field label="PNC (Kg)">
                      <input
                        inputMode="decimal"
                        value={pncKg}
                        onChange={(e) => setPncKg(sanitizeDecimal(e.target.value))}
                        className={inputCls}
                        placeholder="Digite el peso total del producto no conforme en kilogramos"
                      />
                      <p className="mt-1 text-xs text-neutral-600">
                        Digite el peso total del producto no conforme en kilogramos
                      </p>
                    </Field>

                   <Field label="Tiempo Paro">
  <div className="grid grid-cols-2 gap-2">
    <select
      value={horasParo}
      onChange={(e) => setHorasParo(e.target.value)}
      className={inputCls}
    >
      {Array.from({ length: 25 }).map((_, i) => (
        <option key={i} value={String(i)}>
          {i} horas
        </option>
      ))}
    </select>

    <select
      value={minutosParo}
      onChange={(e) => setMinutosParo(e.target.value)}
      className={inputCls}
    >
      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
        <option key={m} value={String(m)}>
          {m} min
        </option>
      ))}
    </select>
  </div>

  <p className="mt-1 text-xs text-neutral-600">
    Selecciona horas y minutos del paro.
  </p>

  <p className="text-xs font-medium text-emerald-700">
    Valor a guardar: {tiempoParoCalculado} h
  </p>
</Field>

                    <Field label="Tipo Paro">
  <select
    value={tipoParo}
    onChange={(e) => setTipoParo(e.target.value)}
    className={inputCls}
  >
    <option value="">Seleccione...</option>
    {paros.map((item) => (
      <option key={item} value={item}>
        {item}
      </option>
    ))}
  </select>
</Field>
                    <Field label="Supervisor">
  <select
    value={supervisor}
    onChange={(e) => setSupervisor(e.target.value)}
    className={inputCls}
  >
    <option value="">Seleccione...</option>
    {supervisores.map((item) => (
      <option key={item} value={item}>
        {item}
      </option>
    ))}
  </select>
</Field>
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
        "rounded-lg px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600"
          : "text-neutral-600 hover:bg-white hover:text-neutral-900",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

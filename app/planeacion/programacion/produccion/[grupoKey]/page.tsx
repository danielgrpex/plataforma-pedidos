// app/planeacion/programacion/produccion/[grupoKey]/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Linea = 1 | 2 | 3 | 4 | 5 | 6;

type GrupoInfo = {
  grupoKey: string;
  referencia: string;
  color: string;
  anchoCm: number;
  // UND
  cantidadTotalUnd: number;
  fechaRequeridaMin?: string; // YYYY-MM-DD
  notas?: string;
};

type GrupoItem = {
  pedidoKey: string;
  consecutivo: string;
  cliente: string;
  oc: string;
  productoTexto: string;
  solicitadoUnd: number;
  reservadoUnd: number;
  porProducirUnd: number;
  fechaRequerida?: string;
};

type ProgramacionRow = {
  id: string;
  linea: Linea;
  ordenProduccion: string; // OPE...
  ciclo: number; // 40, 60, 90...
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  cantidadUnd: number; // UND para esa línea
  observacion?: string;
};

function fmt(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

export default function ProgramarProduccionGrupoPage() {
  const router = useRouter();
  const params = useParams<{ grupoKey: string }>();
  const grupoKey = decodeURIComponent(params.grupoKey || "");

  const [loading, setLoading] = useState(true);

  const [grupo, setGrupo] = useState<GrupoInfo | null>(null);
  const [items, setItems] = useState<GrupoItem[]>([]);
  const [notas, setNotas] = useState("");

  // Tabla de programación (tipo excel pero dentro del sistema)
  const [prog, setProg] = useState<ProgramacionRow[]>([]);

  // formulario rápido para agregar filas
  const [linea, setLinea] = useState<Linea>(1);
  const [ordenProduccion, setOrdenProduccion] = useState("");
  const [ciclo, setCiclo] = useState<number>(60);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [obsRow, setObsRow] = useState("");

  // demo mientras conectamos API
  function demoLoad(k: string) {
    const g: GrupoInfo = {
      grupoKey: k,
      referencia: "Enganche Interno Tipo Bisagra",
      color: "Blanco",
      anchoCm: 4,
      cantidadTotalUnd: 200,
      fechaRequeridaMin: "2026-01-14",
      notas: "",
    };

    const its: GrupoItem[] = [
      {
        pedidoKey: "PK-001",
        consecutivo: "000123",
        cliente: "Jeronimo",
        oc: "OC-C-8899",
        productoTexto: "Enganche Interno Tipo Bisagra | Blanco | 4 cm | 0,992 m | Marca",
        solicitadoUnd: 200,
        reservadoUnd: 0,
        porProducirUnd: 200,
        fechaRequerida: "2026-01-14",
      },
    ];

    setGrupo(g);
    setItems(its);
    setNotas("");
    setProg([
      {
        id: uid(),
        linea: 1,
        ordenProduccion: "",
        ciclo: 60,
        fechaInicio: "",
        fechaFin: "",
        cantidadUnd: 0,
        observacion: "",
      },
    ]);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/planeacion/programacion/produccion/grupo?grupoKey=${encodeURIComponent(grupoKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (json?.success && json?.grupo) {
        setGrupo(json.grupo as GrupoInfo);
        setItems((json.items || []) as GrupoItem[]);
        setNotas(String(json.grupo?.notas || ""));
        setProg(Array.isArray(json.programacion) && json.programacion.length ? json.programacion : []);
      } else {
        demoLoad(grupoKey);
      }
    } catch {
      demoLoad(grupoKey);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (grupoKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoKey]);

  const totalProgramado = useMemo(() => prog.reduce((acc, r) => acc + toNum(r.cantidadUnd), 0), [prog]);
  const totalGrupo = grupo?.cantidadTotalUnd || 0;
  const falta = Math.max(0, totalGrupo - totalProgramado);

  function addRow() {
    setProg((prev) => [
      ...prev,
      {
        id: uid(),
        linea,
        ordenProduccion: ordenProduccion.trim(),
        ciclo: Math.max(0, Math.floor(toNum(ciclo))),
        fechaInicio: inicio,
        fechaFin: fin,
        cantidadUnd: Math.max(0, Math.floor(toNum(qty))),
        observacion: obsRow.trim(),
      },
    ]);

    // reset mínimos (no borramos fechas si estás metiendo varias filas seguidas)
    setQty(0);
    setObsRow("");
  }

  function removeRow(id: string) {
    setProg((prev) => prev.filter((x) => x.id !== id));
  }

  function setCell(id: string, patch: Partial<ProgramacionRow>) {
    setProg((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function llenarLoFaltanteEnUltima() {
    if (falta <= 0) return;
    setProg((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      const next = [...prev];
      next[next.length - 1] = { ...last, cantidadUnd: toNum(last.cantidadUnd) + falta };
      return next;
    });
  }

  async function guardarProgramacion() {
    // frontend first: por ahora solo mostramos payload para validar UX
    const payload = {
      grupoKey,
      notas,
      programacion: prog.map((r) => ({
        linea: r.linea,
        ordenProduccion: r.ordenProduccion,
        ciclo: r.ciclo,
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        cantidadUnd: r.cantidadUnd,
        observacion: r.observacion,
      })),
    };

    // Cuando conectemos backend, reemplazamos por fetch POST.
    console.log("payload-programacion-produccion", payload);
    alert("✅ Front listo. (Backend de guardar lo conectamos después)\nMira el payload en consola.");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/planeacion/programacion?tab=produccion")}
      >
        ← Volver
      </button>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && grupo && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Programar Producción</h1>
              <p className="text-sm text-slate-500">
                Grupo por <b>Referencia + Color + Ancho</b> (UND)
              </p>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-slate-600">Referencia</div>
                    <div className="text-sm font-semibold">{grupo.referencia}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">Color</div>
                    <div className="text-sm font-semibold">{grupo.color}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">Ancho</div>
                    <div className="text-sm font-semibold">{grupo.anchoCm} cm</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-slate-600">Total a producir</div>
                    <div className="text-lg font-semibold">{totalGrupo.toLocaleString("es-CO")} UND</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">Req mínima</div>
                    <div className="text-sm font-semibold">{fmt(grupo.fechaRequeridaMin)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">GrupoKey</div>
                    <div className="text-xs text-slate-400 break-all">{grupo.grupoKey}</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={guardarProgramacion}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Guardar programación
            </button>
          </div>

          {/* Notas */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-xs font-medium mb-1 text-slate-600">
              Notas de programación (para coordinador de planta)
            </label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Observaciones, prioridades, cambios de referencia, etc…"
            />
          </section>

          {/* Items origen */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold">Ítems que componen este grupo</h2>
              <p className="mt-1 text-xs text-slate-500">
                Esto reemplaza tu “Solicitud de producción” manual. (UND)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Pedido</th>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-right font-medium">Solicitado</th>
                    <th className="px-4 py-3 text-right font-medium">Reservado</th>
                    <th className="px-4 py-3 text-right font-medium">Por producir</th>
                    <th className="px-4 py-3 text-left font-medium">Req</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={`${it.pedidoKey}-${it.consecutivo}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{it.consecutivo}</div>
                        <div className="text-xs text-slate-500">{it.cliente}</div>
                        <div className="text-xs text-slate-400">
                          OC {it.oc} · <span className="font-mono">{it.pedidoKey}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{it.productoTexto}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {toNum(it.solicitadoUnd).toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {toNum(it.reservadoUnd).toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {toNum(it.porProducirUnd).toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-3">{fmt(it.fechaRequerida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Programación máquinas */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold">Programación de máquinas (6 líneas)</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  Total programado: <b>{totalProgramado.toLocaleString("es-CO")}</b> UND
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  Falta: <b>{falta.toLocaleString("es-CO")}</b> UND
                </span>
                <button
                  type="button"
                  onClick={llenarLoFaltanteEnUltima}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
                >
                  Llenar lo faltante en última fila
                </button>
              </div>
            </div>

            {/* Form agregar fila */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white">
              <div className="grid gap-2 md:grid-cols-6">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Línea</label>
                  <select
                    value={linea}
                    onChange={(e) => setLinea(Number(e.target.value) as Linea)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Orden producción (OPE)</label>
                  <input
                    value={ordenProduccion}
                    onChange={(e) => setOrdenProduccion(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="OPE250701"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Ciclo</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={ciclo}
                    onChange={(e) => setCiclo(Math.max(0, Math.floor(Number(e.target.value || 0))))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Inicio</label>
                  <input
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Fin</label>
                  <input
                    type="date"
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-6">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Cantidad (UND)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value || 0))))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Observación</label>
                  <input
                    value={obsRow}
                    onChange={(e) => setObsRow(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas de proceso / cambios / prioridad…"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Agregar fila
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla programación */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Línea</th>
                    <th className="px-4 py-3 text-left font-medium">Orden</th>
                    <th className="px-4 py-3 text-right font-medium">Ciclo</th>
                    <th className="px-4 py-3 text-left font-medium">Inicio</th>
                    <th className="px-4 py-3 text-left font-medium">Fin</th>
                    <th className="px-4 py-3 text-right font-medium">Cantidad (UND)</th>
                    <th className="px-4 py-3 text-left font-medium">Obs</th>
                    <th className="px-4 py-3 text-left font-medium">Acción</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {prog.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={8}>
                        Sin filas. Agrega la primera programación arriba.
                      </td>
                    </tr>
                  ) : (
                    prog.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <select
                            value={r.linea}
                            onChange={(e) => setCell(r.id, { linea: Number(e.target.value) as Linea })}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={r.ordenProduccion}
                            onChange={(e) => setCell(r.id, { ordenProduccion: e.target.value })}
                            className="w-48 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="OPE..."
                          />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={r.ciclo}
                            onChange={(e) =>
                              setCell(r.id, { ciclo: Math.max(0, Math.floor(Number(e.target.value || 0))) })
                            }
                            className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm text-right"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={r.fechaInicio || ""}
                            onChange={(e) => setCell(r.id, { fechaInicio: e.target.value })}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={r.fechaFin || ""}
                            onChange={(e) => setCell(r.id, { fechaFin: e.target.value })}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={r.cantidadUnd}
                            onChange={(e) =>
                              setCell(r.id, { cantidadUnd: Math.max(0, Math.floor(Number(e.target.value || 0))) })
                            }
                            className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm text-right"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={r.observacion || ""}
                            onChange={(e) => setCell(r.id, { observacion: e.target.value })}
                            className="w-64 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="—"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                            onClick={() => removeRow(r.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Esta pantalla reemplaza tu Excel de <b>Programación Producción Extrusión</b>. Cuando conectemos backend:
              guardamos esto en una hoja tipo <b>Programación_Máquinas</b> y generamos el PDF / correo para el coordinador.
            </div>
          </section>
        </>
      )}
    </main>
  );
}

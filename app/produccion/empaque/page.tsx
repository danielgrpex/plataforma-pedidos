// app/produccion/empaque/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Turno = "A" | "B" | "C" | "N";
type TabKey = "iniciar" | "finalizar" | "entregar" | "ordenes" | "historial";

type ActividadEnCursoUI = {
  actividadId: string;
  ordenCorteId: string;
  ordenCorteItemId: string;
  trabajador: string;
  turno: Turno;
  horaInicioISO: string;
  estado: "En curso" | "Finalizada";
};

type EntregableUI = {
  ordenCorteItemId: string;
  ordenCorteId: string;
  pedidoKey?: string;
  pedidoRowIndex?: number;
  productoSolicitado?: string;
  cantidadSolicitadaUnd: number;
  cantidadEntregadaUnd: number;
  pendienteUnd: number;
  estadoItem?: string;
  destinoFinal?: string;
};

type OrdenItemUI = {
  ordenCorteItemId: string;
  ordenCorteId: string;
  pedidoKey?: string;
  pedidoRowIndex?: number;
  productoSolicitado?: string;
  cantidadSolicitadaUnd: number;
  cantidadEntregadaUnd: number;
  pendienteUnd: number;
  estadoItem?: string;
  destinoFinal?: string;
  progresoPct: number;
};

const ACTIVIDADES = ["Cortar", "Limpiar", "Encintar", "Imantar", "Rebordear"] as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseAnyDate(s: string): Date | null {
  if (!s) return null;

  const d0 = new Date(s);
  if (!Number.isNaN(d0.getTime())) return d0;

  const raw = String(s).trim();
  const norm = raw
    .replace(/\s+/g, " ")
    .replace(/p\.\s?m\./i, "PM")
    .replace(/a\.\s?m\./i, "AM")
    .replace(/p\.m\./i, "PM")
    .replace(/a\.m\./i, "AM");

  const parts = norm.split(",");
  if (parts.length >= 2) {
    const datePart = parts[0].trim();
    const timePart = parts.slice(1).join(",").trim();

    const dm = datePart.split("/");
    if (dm.length === 3) {
      const dd = Number(dm[0]);
      const mm = Number(dm[1]);
      const yyyy = Number(dm[2]);
      if (Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yyyy)) {
        const m = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (m) {
          let hh = Number(m[1]);
          const min = Number(m[2]);
          const sec = Number(m[3] ?? 0);
          const ap = (m[4] ?? "").toUpperCase();

          if (ap === "PM" && hh < 12) hh += 12;
          if (ap === "AM" && hh === 12) hh = 0;

          const d = new Date(yyyy, mm - 1, dd, hh, min, sec);
          if (!Number.isNaN(d.getTime())) return d;
        }
      }
    }
  }

  return null;
}

function shortISO(maybeISO: string) {
  const d = parseAnyDate(maybeISO);
  if (!d) return maybeISO || "";
  return d.toLocaleString("es-CO");
}

function safeNumber(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtInt(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v).toLocaleString("es-CO");
}

export default function EmpaquePage() {
  const [tab, setTab] = useState<TabKey>("iniciar");

  // ======= INICIAR
  const [iniNombre, setIniNombre] = useState("");
  const [iniTurno, setIniTurno] = useState<Turno>("A");
  const [iniOrdenItemId, setIniOrdenItemId] = useState("");
  const [iniObs, setIniObs] = useState("");

  // ======= FINALIZAR
  const [finNombre, setFinNombre] = useState("");
  const [finTurno, setFinTurno] = useState<Turno>("A");
  const [finActividadId, setFinActividadId] = useState("");
  const [finSeleccion, setFinSeleccion] = useState<string[]>([]);
  const [finUnidades, setFinUnidades] = useState("0");
  const [finDesUnd, setFinDesUnd] = useState("0");
  const [finDesKg, setFinDesKg] = useState("0");
  const [finObs, setFinObs] = useState("");

  // ======= ENTREGAR
  const [entNombre, setEntNombre] = useState("");
  const [entTurno, setEntTurno] = useState<Turno>("A");
  const [entItemId, setEntItemId] = useState("");
  const [entCant, setEntCant] = useState("0");
  const [entObs, setEntObs] = useState("");
  const [loadingEntregables, setLoadingEntregables] = useState(false);
  const [entregables, setEntregables] = useState<EntregableUI[]>([]);

  // ======= ÓRDENES/ÍTEMS (solo lectura)
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [ordenItems, setOrdenItems] = useState<OrdenItemUI[]>([]);

  // ======= Search global
  const [search, setSearch] = useState("");

  // mock para iniciar (autocompletar)
  const [itemsMock] = useState<string[]>(["OC-2025-00037 - 52", "OC-2025-00037 - 53"]);

  const itemsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return itemsMock;
    return itemsMock.filter((x) => x.toLowerCase().includes(q));
  }, [search, itemsMock]);

  // ======= DATA REAL (en-curso)
  const [actividades, setActividades] = useState<ActividadEnCursoUI[]>([]);
  const [loadingActividades, setLoadingActividades] = useState(false);

  async function refreshEnCurso() {
    try {
      setLoadingActividades(true);
      const res = await fetch("/api/produccion/empaque/en-curso", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.error(data?.message || "Error cargando en-curso");
        return;
      }
      setActividades(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActividades(false);
    }
  }

  async function refreshEntregables() {
    try {
      setLoadingEntregables(true);
      const res = await fetch("/api/produccion/empaque/entregables", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.error(data?.message || "Error cargando entregables");
        return;
      }
      setEntregables(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEntregables(false);
    }
  }

  async function refreshOrdenesItems() {
    try {
      setLoadingOrdenes(true);
      const res = await fetch("/api/produccion/empaque/ordenes-items", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.error(data?.message || "Error cargando órdenes/ítems");
        return;
      }
      setOrdenItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrdenes(false);
    }
  }

  // carga inicial
  useEffect(() => {
    refreshEnCurso();
    refreshEntregables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refrescos por pestaña
  useEffect(() => {
    if (tab === "finalizar") refreshEnCurso();
    if (tab === "entregar") refreshEntregables();
    if (tab === "ordenes") refreshOrdenesItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ======= INICIAR
  const iniciarDisabled = !iniNombre.trim() || !iniOrdenItemId.trim();

  async function onIniciar() {
    if (iniciarDisabled) return;

    try {
      const res = await fetch("/api/produccion/empaque/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          trabajador: iniNombre.trim(),
          turno: iniTurno,
          ordenCorteItemId: iniOrdenItemId.trim(),
          observaciones: iniObs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.message || "Error iniciando actividad");
        return;
      }

      const nuevo: ActividadEnCursoUI = {
        actividadId: data.actividadId,
        ordenCorteId: data.ordenCorteId,
        ordenCorteItemId: data.ordenCorteItemId,
        trabajador: data.trabajador,
        turno: data.turno,
        horaInicioISO: data.horaInicioISO,
        estado: "En curso",
      };

      setActividades((prev) => [nuevo, ...prev]);

      setIniObs("");
      setIniOrdenItemId("");
      alert("✅ Actividad iniciada y guardada en Corte_Actividades");

      refreshEnCurso();
    } catch (e: any) {
      alert(e?.message || "Error iniciando actividad");
    }
  }

  // ======= FINALIZAR
  const actividadesEnCurso = useMemo(
    () => actividades.filter((a) => a.estado === "En curso"),
    [actividades]
  );

  const actividadesEnCursoDelTrabajador = useMemo(() => {
    const n = finNombre.trim().toLowerCase();
    if (!n) return actividadesEnCurso;
    return actividadesEnCurso.filter((a) => a.trabajador.toLowerCase() === n);
  }, [actividadesEnCurso, finNombre]);

  function toggleActividadHecha(a: string) {
    setFinSeleccion((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  const finalizarDisabled =
    !finNombre.trim() || !finActividadId || finSeleccion.length === 0 || safeNumber(finUnidades) <= 0;

  async function onFinalizar() {
    if (finalizarDisabled) return;

    try {
      const res = await fetch("/api/produccion/empaque/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          actividadId: finActividadId,
          trabajador: finNombre.trim(),
          turno: finTurno,
          actividades: finSeleccion,
          unidadesHechas: safeNumber(finUnidades),
          desperdicioUnd: safeNumber(finDesUnd),
          desperdicioKg: safeNumber(finDesKg),
          observaciones: finObs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.message || "Error finalizando actividad");
        return;
      }

      alert("✅ Actividad finalizada y actualizada en Corte_Actividades");

      setFinActividadId("");
      setFinSeleccion([]);
      setFinUnidades("0");
      setFinDesUnd("0");
      setFinDesKg("0");
      setFinObs("");

      refreshEnCurso();
    } catch (e: any) {
      alert(e?.message || "Error finalizando actividad");
    }
  }

  // ======= ENTREGAR
  const entregablesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entregables;
    return entregables.filter((x) => {
      const s =
        `${x.ordenCorteItemId} ${x.ordenCorteId} ${x.pedidoKey ?? ""} ${x.productoSolicitado ?? ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [entregables, search]);

  const itemSeleccionado = useMemo(
    () => entregables.find((x) => x.ordenCorteItemId === entItemId),
    [entregables, entItemId]
  );

  const entMax = itemSeleccionado ? itemSeleccionado.pendienteUnd : 0;

  const entregarDisabled =
    !entNombre.trim() || !entItemId || safeNumber(entCant) <= 0 || safeNumber(entCant) > entMax;

  async function onEntregar() {
    if (entregarDisabled) return;

    try {
      const res = await fetch("/api/produccion/empaque/entregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          trabajador: entNombre.trim(),
          turno: entTurno,
          ordenCorteItemId: entItemId,
          cantidadEntregadaUnd: safeNumber(entCant),
          observaciones: entObs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.message || "Error entregando a almacén");
        return;
      }

      alert(
        `✅ Entrega registrada.\nEntregado: ${data.cantidadEntregadaUnd}\nRestante: ${data.restante}\nEstado item: ${data.estadoItemNuevo}`
      );

      setEntCant("0");
      setEntObs("");
      // refrescar entregables (pendiente baja)
      refreshEntregables();
      // refrescar órdenes/ítems por si están mirando esa pestaña
      refreshOrdenesItems();
    } catch (e: any) {
      alert(e?.message || "Error entregando a almacén");
    }
  }

  // ======= ÓRDENES/ÍTEMS (solo lectura)
  const ordenItemsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordenItems;
    return ordenItems.filter((x) => {
      const s =
        `${x.ordenCorteId} ${x.ordenCorteItemId} ${x.pedidoKey ?? ""} ${x.productoSolicitado ?? ""} ${
          x.destinoFinal ?? ""
        } ${x.estadoItem ?? ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [ordenItems, search]);

  const ordenesAgrupadas = useMemo(() => {
    const m = new Map<
      string,
      {
        ordenCorteId: string;
        items: OrdenItemUI[];
        totalSolic: number;
        totalEnt: number;
        totalPend: number;
        progresoPct: number;
      }
    >();

    for (const it of ordenItemsFiltrados) {
      const g = m.get(it.ordenCorteId) || {
        ordenCorteId: it.ordenCorteId,
        items: [],
        totalSolic: 0,
        totalEnt: 0,
        totalPend: 0,
        progresoPct: 0,
      };
      g.items.push(it);
      g.totalSolic += it.cantidadSolicitadaUnd || 0;
      g.totalEnt += it.cantidadEntregadaUnd || 0;
      g.totalPend += it.pendienteUnd || 0;
      m.set(it.ordenCorteId, g);
    }

    const arr = Array.from(m.values());
    arr.forEach((g) => {
      g.items.sort((a, b) => a.ordenCorteItemId.localeCompare(b.ordenCorteItemId));
      g.progresoPct = g.totalSolic > 0 ? Number(((g.totalEnt / g.totalSolic) * 100).toFixed(2)) : 0;
    });

    arr.sort((a, b) => a.ordenCorteId.localeCompare(b.ordenCorteId));
    return arr;
  }, [ordenItemsFiltrados]);

  // ======= KPI (por ahora simple)
  const kpis = useMemo(() => {
    const activos = actividadesEnCurso.length;

    const listos = entregables.length; // “para entrega”
    // en proceso: items con pendiente>0 en ordenItems (si ya cargó)
    const enProceso = ordenItems.length
      ? ordenItems.filter((x) => x.pendienteUnd > 0 && x.cantidadEntregadaUnd > 0).length
      : 1;

    return {
      pendientes: 1,
      enProceso,
      listos,
      enAlmacen: 0,
      activos,
    };
  }, [actividadesEnCurso.length, entregables.length, ordenItems.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl border bg-slate-50">
                <span className="text-sm font-semibold text-slate-700">GR</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    Producción
                  </span>
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                    Empaque
                  </span>
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Control operativo — Empaque
                </h1>
                <p className="text-sm text-slate-600">
                  Flujo simple para operarios: iniciar, finalizar y entregar (con trazabilidad).
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Operación normal
                </span>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar OC / Item / Cliente / Producto..."
                  className="h-9 w-full rounded-xl border bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 md:w-[320px]"
                />

                <button
                  type="button"
                  onClick={() => {
                    refreshEnCurso();
                    refreshEntregables();
                    if (tab === "ordenes") refreshOrdenesItems();
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  title="Refrescar"
                >
                  Refrescar
                </button>

                <Link
                  href="/produccion"
                  className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Volver
                </Link>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex flex-wrap gap-2">
            <TabButton active={tab === "iniciar"} onClick={() => setTab("iniciar")}>
              Iniciar actividad
            </TabButton>
            <TabButton active={tab === "finalizar"} onClick={() => setTab("finalizar")}>
              Finalizar actividad
            </TabButton>
            <TabButton active={tab === "entregar"} onClick={() => setTab("entregar")}>
              Entregar a almacén
            </TabButton>
            <TabButton active={tab === "ordenes"} onClick={() => setTab("ordenes")}>
              Órdenes / ítems
            </TabButton>
            <TabButton active={tab === "historial"} onClick={() => setTab("historial")}>
              Historial
            </TabButton>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-5">
          <KpiCard label="Pendientes" value={kpis.pendientes} sub="Listos para iniciar" />
          <KpiCard label="En proceso" value={kpis.enProceso} sub="Ítems con avance" />
          <KpiCard label="Listos" value={kpis.listos} sub="Para entrega" />
          <KpiCard label="En almacén" value={kpis.enAlmacen} sub="Cerrados por ítem" />
          <KpiCard label="Actividades en curso" value={kpis.activos} sub="En planta" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Main panel */}
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            {tab === "iniciar" && (
              <section>
                <HeaderBlock
                  title="1) Iniciar actividad"
                  subtitle="Operario: selecciona tu nombre, turno y el ordenCorteItemId. Esto crea un registro “En curso”."
                />

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Nombre (operario)">
                    <input
                      value={iniNombre}
                      onChange={(e) => setIniNombre(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: Juan"
                    />
                  </Field>

                  <Field label="Turno">
                    <select
                      value={iniTurno}
                      onChange={(e) => setIniTurno(e.target.value as Turno)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="A">Turno A</option>
                      <option value="B">Turno B</option>
                      <option value="C">Turno C</option>
                      <option value="N">Noche</option>
                    </select>
                  </Field>

                  <Field label="Consecutivo (ordenCorteItemId)">
                    <input
                      value={iniOrdenItemId}
                      onChange={(e) => setIniOrdenItemId(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: OC-2025-00037 - 52"
                      list="orden-items"
                    />
                    <datalist id="orden-items">
                      {itemsFiltrados.map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-slate-500">Tip: escribe “OC-2025” o el número “52”.</p>
                  </Field>

                  <Field label="Observaciones (opcional)">
                    <input
                      value={iniObs}
                      onChange={(e) => setIniObs(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: inicio de turno..."
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={onIniciar}
                    disabled={iniciarDisabled}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                      iniciarDisabled
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    Iniciar
                  </button>

                  <span className="text-xs text-slate-500">
                    Guarda en <span className="font-medium">Corte_Actividades</span>.
                  </span>
                </div>

                <Divider />

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-900">Actividades en curso</h3>
                  <p className="text-sm text-slate-600">Lista rápida (desde la Sheet).</p>

                  <div className="mt-3 overflow-hidden rounded-2xl border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Orden</th>
                          <th className="px-3 py-2">Operario</th>
                          <th className="px-3 py-2">Turno</th>
                          <th className="px-3 py-2">Inicio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actividadesEnCurso.length === 0 ? (
                          <tr>
                            <td className="px-3 py-4 text-slate-500" colSpan={4}>
                              {loadingActividades ? "Cargando..." : "No hay actividades en curso."}
                            </td>
                          </tr>
                        ) : (
                          actividadesEnCurso.slice(0, 10).map((a) => (
                            <tr key={a.actividadId} className="border-t">
                              <td className="px-3 py-2 font-medium text-slate-900">{a.ordenCorteItemId}</td>
                              <td className="px-3 py-2 text-slate-700">{a.trabajador}</td>
                              <td className="px-3 py-2 text-slate-700">{a.turno}</td>
                              <td className="px-3 py-2 text-slate-600">{shortISO(a.horaInicioISO)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {tab === "finalizar" && (
              <section>
                <HeaderBlock
                  title="2) Finalizar actividad"
                  subtitle="Selecciona tu nombre, elige una actividad en curso y reporta lo ejecutado."
                />

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Nombre (operario)">
                    <input
                      value={finNombre}
                      onChange={(e) => setFinNombre(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: Juan"
                    />
                  </Field>

                  <Field label="Turno">
                    <select
                      value={finTurno}
                      onChange={(e) => setFinTurno(e.target.value as Turno)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="A">Turno A</option>
                      <option value="B">Turno B</option>
                      <option value="C">Turno C</option>
                      <option value="N">Noche</option>
                    </select>
                  </Field>

                  <Field label="Actividad en curso">
                    <select
                      value={finActividadId}
                      onChange={(e) => setFinActividadId(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="">Selecciona…</option>
                      {actividadesEnCursoDelTrabajador.map((a) => (
                        <option key={a.actividadId} value={a.actividadId}>
                          {a.ordenCorteItemId} — {a.trabajador} ({shortISO(a.horaInicioISO)})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Trae “En curso”. Si pones tu nombre, filtra.</p>
                  </Field>

                  <Field label="Unidades hechas (und)">
                    <input
                      value={finUnidades}
                      onChange={(e) => setFinUnidades(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Desperdicio (und)">
                    <input
                      value={finDesUnd}
                      onChange={(e) => setFinDesUnd(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Desperdicio (kg)">
                    <input
                      value={finDesKg}
                      onChange={(e) => setFinDesKg(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      inputMode="decimal"
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-900">Actividad(es) realizadas</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ACTIVIDADES.map((a) => {
                      const active = finSeleccion.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleActividadHecha(a)}
                          className={cx(
                            "rounded-full border px-3 py-1.5 text-sm",
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <Field label="Observaciones (opcional)">
                    <input
                      value={finObs}
                      onChange={(e) => setFinObs(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: ajuste de calidad, novedad..."
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onFinalizar}
                    disabled={finalizarDisabled}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                      finalizarDisabled
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    Finalizar
                  </button>

                  <span className="text-xs text-slate-500">
                    Actualiza la fila en <span className="font-medium">Corte_Actividades</span>.
                  </span>
                </div>
              </section>
            )}

            {tab === "entregar" && (
              <section>
                <HeaderBlock
                  title="3) Entregar a almacén"
                  subtitle="Supervisor: registra la entrega (parcial o total). Esto crea un movimiento y actualiza estados."
                />

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Responsable (supervisor)">
                    <input
                      value={entNombre}
                      onChange={(e) => setEntNombre(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: Coordinador / Supervisor"
                    />
                  </Field>

                  <Field label="Turno">
                    <select
                      value={entTurno}
                      onChange={(e) => setEntTurno(e.target.value as Turno)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="A">Turno A</option>
                      <option value="B">Turno B</option>
                      <option value="C">Turno C</option>
                      <option value="N">Noche</option>
                    </select>
                  </Field>

                  <Field label="Ítem a entregar (ordenCorteItemId)">
                    <select
                      value={entItemId}
                      onChange={(e) => {
                        setEntItemId(e.target.value);
                        setEntCant("0");
                      }}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="">Selecciona…</option>
                      {entregablesFiltrados.map((x) => (
                        <option key={x.ordenCorteItemId} value={x.ordenCorteItemId}>
                          {x.ordenCorteItemId} · Pend: {fmtInt(x.pendienteUnd)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Fuente: <span className="font-medium">/api/produccion/empaque/entregables</span> (pendiente real).
                      {loadingEntregables ? " Cargando..." : ""}
                    </p>
                  </Field>

                  <Field label="Cantidad a entregar (und)">
                    <input
                      value={entCant}
                      onChange={(e) => setEntCant(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      inputMode="decimal"
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Máx: <span className="font-medium">{fmtInt(entMax)}</span>
                    </p>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Observaciones (opcional)">
                    <input
                      value={entObs}
                      onChange={(e) => setEntObs(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: entrega parcial, se deja pendiente..."
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onEntregar}
                    disabled={entregarDisabled}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                      entregarDisabled
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    Entregar
                  </button>

                  <span className="text-xs text-slate-500">
                    Crea fila en <span className="font-medium">MovimientosInventario</span> y actualiza estados.
                  </span>
                </div>

                <Divider />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Entregables</div>
                    <div className="mt-2 text-sm text-slate-600">
                      {entregables.length === 0 ? "No hay ítems disponibles para entregar." : `${entregables.length} ítem(s) disponibles.`}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Ayuda</div>
                    <div className="mt-2 text-sm text-slate-600">
                      La lista incluye ítems aunque estén “En curso” o “Finalizadas”. Solo desaparecen cuando el corte quede 100% en “Almacén”.
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "ordenes" && (
              <section>
                <HeaderBlock
                  title="Órdenes / ítems (solo lectura)"
                  subtitle="Vista agrupada por ordenCorteId. Entregado se calcula desde MovimientosInventario (Entrega a almacén)."
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshOrdenesItems}
                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {loadingOrdenes ? "Cargando..." : "Refrescar Órdenes"}
                  </button>

                  <span className="text-xs text-slate-500">
                    Fuente: <span className="font-medium">/api/produccion/empaque/ordenes-items</span>
                  </span>
                </div>

                <Divider />

                {ordenesAgrupadas.length === 0 ? (
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                    {loadingOrdenes ? "Cargando..." : "No hay datos para mostrar con el filtro actual."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ordenesAgrupadas.map((g) => {
                      const pct = clamp(g.progresoPct, 0, 100);
                      return (
                        <div key={g.ordenCorteId} className="rounded-3xl border bg-white p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{g.ordenCorteId}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                Ítems: <span className="font-medium">{g.items.length}</span> · Solicitado:{" "}
                                <span className="font-medium">{fmtInt(g.totalSolic)}</span> · Entregado:{" "}
                                <span className="font-medium">{fmtInt(g.totalEnt)}</span> · Pendiente:{" "}
                                <span className="font-medium">{fmtInt(g.totalPend)}</span>
                              </div>
                            </div>

                            <div className="w-full md:w-[280px]">
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Avance</span>
                                <span className="font-medium">{pct.toFixed(2)}%</span>
                              </div>
                              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-slate-900"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 overflow-hidden rounded-2xl border">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">Item</th>
                                  <th className="px-3 py-2">Pedido</th>
                                  <th className="px-3 py-2">Producto (key)</th>
                                  <th className="px-3 py-2 text-right">Solic.</th>
                                  <th className="px-3 py-2 text-right">Entreg.</th>
                                  <th className="px-3 py-2 text-right">Pend.</th>
                                  <th className="px-3 py-2">Estado</th>
                                  <th className="px-3 py-2">Destino</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((it) => {
                                  const itPct = clamp(it.progresoPct, 0, 100);
                                  return (
                                    <tr key={it.ordenCorteItemId} className="border-t">
                                      <td className="px-3 py-2 font-medium text-slate-900">
                                        <div className="flex flex-col">
                                          <span>{it.ordenCorteItemId}</span>
                                          <span className="text-xs text-slate-500">{itPct.toFixed(2)}%</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {it.pedidoKey ?? "-"}
                                        {typeof it.pedidoRowIndex === "number" ? ` · row ${it.pedidoRowIndex}` : ""}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">{it.productoSolicitado ?? "-"}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(it.cantidadSolicitadaUnd)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(it.cantidadEntregadaUnd)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(it.pendienteUnd)}</td>
                                      <td className="px-3 py-2 text-slate-700">{it.estadoItem ?? "-"}</td>
                                      <td className="px-3 py-2 text-slate-700">{it.destinoFinal ?? "-"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {tab === "historial" && (
              <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                Historial lo conectamos enseguida (MovimientosInventario + Corte_Actividades).
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Checklist (operación)</div>
                  <div className="text-sm text-slate-600">Guía corta para operarios.</div>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">PEX</span>
              </div>

              <ol className="mt-4 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    1
                  </span>
                  Inicia con <span className="font-medium">tu nombre + turno + ordenCorteItemId</span>.
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    2
                  </span>
                  Al finalizar: marca <span className="font-medium">actividades</span>, unidades y desperdicio.
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    3
                  </span>
                  Supervisor registra entregas parciales hasta completar.
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    4
                  </span>
                  Al completar, estado pasa a <span className="font-medium">Almacén</span>.
                </li>
              </ol>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-3 text-xs text-slate-600">
                Tip: “Órdenes / ítems” calcula entregado desde <span className="font-medium">MovimientosInventario</span>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== UI bits ===================== */
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
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function HeaderBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tracking-tight text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function Divider() {
  return <div className="my-5 h-px w-full bg-slate-200" />;
}

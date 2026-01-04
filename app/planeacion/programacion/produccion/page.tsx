"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Linea = "Linea 1" | "Linea 2" | "Linea 3" | "Linea 4" | "Linea 5" | "Linea 6";
const LINEAS: Linea[] = ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5", "Linea 6"];

/** =========================
 *  GENERAR OPE (pendientes)
 *  ========================= */
type SolicitudProdPendiente = {
  solicitudProdId: string;
  pedidoKey: string;
  rowIndexPedido: string; // texto desde Sheets
  productoKey: string;
  cantidadUND: string;
  estado: string; // Pendiente
  fechaCreacion?: string;
  fechaUltActualizacion?: string;
  usuario?: string;
  OPE?: string;
};

function toNumberStr(v?: string) {
  if (!v) return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatFechaColombia(value?: string) {
  if (!value) return "—";

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    const day = String(date.getDate()).padStart(2, "0");
    const month = date
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const d2 = new Date(value);
  if (!Number.isNaN(d2.getTime())) {
    const day = String(d2.getDate()).padStart(2, "0");
    const month = d2
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = d2.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return value;
}

/** =========================
 *  PRODUCCIÓN (colas)
 *  ========================= */
type OpeListItem = {
  ope: string; // "OPE260001"
  items: number;
  totalUND: number;
};

type OpeDetalleItem = {
  solicitudProdId?: string;
  pedidoKey?: string;
  rowIndexPedido?: number;
  productoKey: string;
  cantidadUND: number;
  cliente?: string;
  estado?: string;
};

type OpeDetalle = {
  ope: string;
  estado?: string;
  items: OpeDetalleItem[];
  totalUND: number;
};

type ColaItem = {
  ope: string;
  pos: number; // 1..n
  estado?: string; // "En cola" | "En producción" ...
  totalUND?: number;
};

type ColasResponse = Record<string, ColaItem[]>; // { "Linea 1": [...], ... }

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lineaLabel(l: Linea) {
  return l.replace("Linea", "Línea");
}

function sortByPos(list: ColaItem[]) {
  return [...list].sort((a, b) => toNum(a.pos) - toNum(b.pos));
}

export default function PlaneacionProgramacionProduccionPage() {
  const router = useRouter();

  // ✅ Tabs: Generar OPE / Programar / Ver programación
  const [tab, setTab] = useState<"generar" | "programar" | "ver">("generar");

  /** =========================
   *  TAB GENERAR OPE
   *  ========================= */
  const [qSol, setQSol] = useState("");
  const [solItems, setSolItems] = useState<SolicitudProdPendiente[]>([]);
  const [loadingSol, setLoadingSol] = useState(true);
  const [errSol, setErrSol] = useState("");
  const [msgSol, setMsgSol] = useState("");
  const [creatingOPE, setCreatingOPE] = useState(false);
  const [selectedSol, setSelectedSol] = useState<Record<string, boolean>>({});

  async function loadSolicitudesPendientes() {
    setErrSol("");
    setMsgSol("");
    setLoadingSol(true);

    try {
      const url = `/api/planeacion/programacion/solicitudes?estado=Pendiente&q=${encodeURIComponent(
        qSol.trim()
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "No se pudieron cargar las solicitudes.");
      }

      const list = (json.items || []) as SolicitudProdPendiente[];
      setSolItems(list);

      // mantener selección solo para ids existentes
      setSelectedSol((prev) => {
        const next: Record<string, boolean> = {};
        const allow = new Set(list.map((x) => x.solicitudProdId));
        Object.entries(prev).forEach(([id, v]) => {
          if (allow.has(id) && v) next[id] = true;
        });
        return next;
      });
    } catch (e: any) {
      console.error(e);
      setErrSol(e?.message || "Error cargando solicitudes.");
      setSolItems([]);
      setSelectedSol({});
    } finally {
      setLoadingSol(false);
    }
  }

  const selectedSolIds = useMemo(
    () => Object.entries(selectedSol).filter(([, v]) => v).map(([k]) => k),
    [selectedSol]
  );

  const selectedSolRows = useMemo(() => {
    const map = new Map(solItems.map((x) => [x.solicitudProdId, x]));
    return selectedSolIds.map((id) => map.get(id)).filter(Boolean) as SolicitudProdPendiente[];
  }, [solItems, selectedSolIds]);

  const totalSelectedSolUND = useMemo(
    () => selectedSolRows.reduce((acc, x) => acc + toNumberStr(x.cantidadUND), 0),
    [selectedSolRows]
  );

  const agrupadoPorProducto = useMemo(() => {
    const m = new Map<string, { productoKey: string; und: number; count: number }>();
    for (const s of selectedSolRows) {
      const key = (s.productoKey || "—").trim();
      const cur = m.get(key) || { productoKey: key, und: 0, count: 0 };
      cur.und += toNumberStr(s.cantidadUND);
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.und - a.und);
  }, [selectedSolRows]);

  const allCheckedSol = useMemo(() => {
    if (!solItems.length) return false;
    return solItems.every((x) => selectedSol[x.solicitudProdId]);
  }, [solItems, selectedSol]);

  function toggleAllSol() {
    if (!solItems.length) return;
    setSelectedSol((prev) => {
      const next: Record<string, boolean> = { ...prev };
      if (allCheckedSol) {
        solItems.forEach((x) => delete next[x.solicitudProdId]);
      } else {
        solItems.forEach((x) => (next[x.solicitudProdId] = true));
      }
      return next;
    });
  }

  /** =========================
   *  PRODUCCIÓN: Programar/Ver
   *  ========================= */
  const [q, setQ] = useState("");

  const [opes, setOpes] = useState<OpeListItem[]>([]);
  const [loadingOpes, setLoadingOpes] = useState(true);
  const [errOpes, setErrOpes] = useState<string>("");

  const [selectedOpe, setSelectedOpe] = useState<string>("");
  const [detalle, setDetalle] = useState<OpeDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [errDetalle, setErrDetalle] = useState<string>("");

  const [colas, setColas] = useState<ColasResponse>({});
  const [loadingColas, setLoadingColas] = useState(true);
  const [errColas, setErrColas] = useState<string>("");

  const [lineaSel, setLineaSel] = useState<Linea>("Linea 1");
  const [prioMode, setPrioMode] = useState<"inicio" | "final" | "despues">("final");
  const [posDespues, setPosDespues] = useState<number>(1);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // VER PROGRAMACIÓN
  const [verLineaSel, setVerLineaSel] = useState<Linea>("Linea 1");
  const [colasLocal, setColasLocal] = useState<ColasResponse>({});
  const [openOpe, setOpenOpe] = useState<Record<string, boolean>>({});
  const [detalleCache, setDetalleCache] = useState<
    Record<string, { loading: boolean; error?: string; detalle?: OpeDetalle }>
  >({});

  async function loadOpes() {
    setLoadingOpes(true);
    setErrOpes("");
    try {
      const url = `/api/planeacion/programacion/produccion/opes/list?estado=Programado&q=${encodeURIComponent(
        q.trim()
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudieron cargar las OPE.");
      setOpes((json.items || []) as OpeListItem[]);
    } catch (e) {
      setErrOpes(e instanceof Error ? e.message : "Error cargando OPE.");
      setOpes([]);
    } finally {
      setLoadingOpes(false);
    }
  }

  async function loadColas() {
    setLoadingColas(true);
    setErrColas("");
    try {
      const res = await fetch(`/api/planeacion/programacion/produccion/colas`, { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudieron cargar colas.");
      const lineas = (json.lineas || {}) as ColasResponse;

      const normalized: ColasResponse = {};
      for (const l of LINEAS) {
        normalized[l] = sortByPos((lineas[l] || []) as ColaItem[]);
      }
      setColas(normalized);
      setColasLocal(normalized);
    } catch (e) {
      setErrColas(e instanceof Error ? e.message : "Error cargando colas.");
      setColas({});
      setColasLocal({});
    } finally {
      setLoadingColas(false);
    }
  }

  async function loadDetalle(ope: string) {
    if (!ope) {
      setDetalle(null);
      return;
    }
    setLoadingDetalle(true);
    setErrDetalle("");
    try {
      const res = await fetch(
        `/api/planeacion/programacion/produccion/opes/detalle?ope=${encodeURIComponent(ope)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cargar el detalle.");
      setDetalle(json.detalle as OpeDetalle);
    } catch (e) {
      setErrDetalle(e instanceof Error ? e.message : "Error cargando detalle.");
      setDetalle(null);
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function ensureDetalleInCache(ope: string) {
    if (!ope) return;

    const current = detalleCache[ope];
    if (current?.loading) return;
    if (current?.detalle) return;

    setDetalleCache((prev) => ({ ...prev, [ope]: { loading: true } }));
    try {
      const res = await fetch(
        `/api/planeacion/programacion/produccion/opes/detalle?ope=${encodeURIComponent(ope)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cargar el detalle.");

      setDetalleCache((prev) => ({
        ...prev,
        [ope]: { loading: false, detalle: json.detalle as OpeDetalle },
      }));
    } catch (e) {
      setDetalleCache((prev) => ({
        ...prev,
        [ope]: {
          loading: false,
          error: e instanceof Error ? e.message : "Error cargando detalle.",
        },
      }));
    }
  }

  useEffect(() => {
    loadSolicitudesPendientes();
    loadOpes();
    loadColas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDetalle(selectedOpe);

    const cola = colas[lineaSel] || [];
    const maxPos = Math.max(1, cola.length);
    setPosDespues((prev) => Math.min(Math.max(1, prev), maxPos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpe]);

  useEffect(() => {
    const cola = colas[lineaSel] || [];
    const maxPos = Math.max(1, cola.length);
    setPosDespues((prev) => Math.min(Math.max(1, prev), maxPos));
  }, [lineaSel, colas]);

  const colaLineaSel = useMemo(() => colas[lineaSel] || [], [colas, lineaSel]);

  const resumenLineaSel = useMemo(() => {
    const cola = colaLineaSel;
    const n = cola.length;
    return {
      enCola: n,
      top: cola[0]?.ope || "",
      last: cola[n - 1]?.ope || "",
    };
  }, [colaLineaSel]);

  const puedeAgregar = useMemo(() => {
    if (!selectedOpe) return false;
    if (saving) return false;
    return true;
  }, [selectedOpe, saving]);

  async function agregarACola() {
    if (!selectedOpe) return;
    setSaving(true);
    setSaveMsg("");

    try {
      const payload = {
        ope: selectedOpe,
        linea: lineaSel,
        prioridad:
          prioMode === "inicio"
            ? { mode: "inicio" }
            : prioMode === "final"
            ? { mode: "final" }
            : { mode: "despues", pos: Math.max(1, Math.floor(posDespues || 1)) },
        usuario: "planeacion",
      };

      const res = await fetch(`/api/planeacion/programacion/produccion/colas/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo agregar a la cola.");

      setSaveMsg(`✅ ${selectedOpe} agregada a ${lineaLabel(lineaSel)}.`);
      await Promise.all([loadColas(), loadOpes()]);
      setSelectedOpe("");
      setDetalle(null);
    } catch (e) {
      setSaveMsg(`❌ ${e instanceof Error ? e.message : "Error agregando a cola."}`);
    } finally {
      setSaving(false);
    }
  }

  async function crearOPEDesdeSolicitudes() {
    setErrSol("");
    setMsgSol("");

    if (!selectedSolIds.length) {
      setErrSol("Selecciona al menos 1 solicitud.");
      return;
    }

    try {
      setCreatingOPE(true);
      setMsgSol("Creando OPE…");

      const res = await fetch("/api/planeacion/programacion/ope/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudProdIds: selectedSolIds,
          usuario: "planeacion",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "No se pudo crear la OPE.");
      }

      const ope = String(json.ope || "").trim();
      setMsgSol(ope ? `✅ OPE creada: ${ope}` : "✅ OPE creada.");

      await Promise.all([loadSolicitudesPendientes(), loadOpes()]);
      setSelectedSol({});
    } catch (e: any) {
      console.error(e);
      setErrSol(e?.message || "Error creando OPE.");
    } finally {
      setCreatingOPE(false);
      setTimeout(() => setMsgSol(""), 5000);
    }
  }

  // ====== Ver programación helpers ======
  const colaVerSel = useMemo(() => {
    const base = colasLocal[verLineaSel] || [];
    return sortByPos(base);
  }, [colasLocal, verLineaSel]);

  const undTotalLinea = useMemo(() => {
    let sum = 0;
    for (const x of colaVerSel) {
      const d = detalleCache[x.ope]?.detalle;
      if (d) sum += toNum(d.totalUND);
    }
    return sum;
  }, [colaVerSel, detalleCache]);

  function toggleOpen(ope: string) {
    setOpenOpe((prev) => ({ ...prev, [ope]: !prev[ope] }));
    const willOpen = !openOpe[ope];
    if (willOpen) ensureDetalleInCache(ope);
  }

  function moveOpe(linea: Linea, ope: string, dir: "up" | "down") {
    setColasLocal((prev) => {
      const list = sortByPos((prev[linea] || []) as ColaItem[]);
      const idx = list.findIndex((x) => x.ope === ope);
      if (idx < 0) return prev;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= list.length) return prev;

      const a = { ...list[idx] };
      const b = { ...list[swapWith] };

      const tmp = a.pos;
      a.pos = b.pos;
      b.pos = tmp;

      const nextList = list.map((x) => {
        if (x.ope === a.ope) return a;
        if (x.ope === b.ope) return b;
        return x;
      });

      return { ...prev, [linea]: sortByPos(nextList) };
    });
  }

  function resetOrdenLinea(linea: Linea) {
    setColasLocal((prev) => ({ ...prev, [linea]: sortByPos(colas[linea] || []) }));
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación · Programación · Producción</h1>
          <p className="text-sm text-slate-500">
            1) Genera OPE → 2) Programa en línea → 3) Ver cola tipo planta.
          </p>
        </div>

        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          onClick={() => router.push("/planeacion/programacion")}
          type="button"
        >
          ← Volver
        </button>
      </div>

      {/* Tabs */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "generar" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setTab("generar")}
            type="button"
          >
            Generar OPE
          </button>

          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "programar" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setTab("programar")}
            type="button"
          >
            Programar OPE
          </button>

          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "ver" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setTab("ver")}
            type="button"
          >
            Ver programación
          </button>
        </div>
      </section>

      {/* ===========================
          TAB: GENERAR OPE
         =========================== */}
      {tab === "generar" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={qSol}
                onChange={(e) => setQSol(e.target.value)}
                className="w-full md:w-[520px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por pedidoKey, productoKey, estado…"
              />
              <button
                onClick={loadSolicitudesPendientes}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loadingSol}
                type="button"
              >
                {loadingSol ? "Cargando…" : "Buscar"}
              </button>

              <div className="flex-1" />

              <button
                onClick={crearOPEDesdeSolicitudes}
                disabled={creatingOPE || !selectedSolIds.length}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                type="button"
                title="Crear OPE para las solicitudes seleccionadas"
              >
                {creatingOPE ? "Creando…" : `Crear OPE (${selectedSolIds.length})`}
              </button>
            </div>

            {(msgSol || errSol) && (
              <div className="mt-3">
                {msgSol && <p className="text-xs text-emerald-600">{msgSol}</p>}
                {errSol && <p className="text-xs text-red-500">{errSol}</p>}
              </div>
            )}
          </section>

          {/* Resumen selección */}
          <section className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">Selección actual</div>
              <div className="mt-2 text-sm text-slate-600">
                Ítems: <b>{selectedSolIds.length}</b>
              </div>
              <div className="text-sm text-slate-600">
                Total UND: <b>{totalSelectedSolUND.toLocaleString("es-CO")}</b>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Al crear OPE, todos los ítems seleccionados quedan con el mismo consecutivo (ej: <b>OPE260001</b>).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">Agrupado por productoKey</div>
              {selectedSolIds.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Selecciona ítems para ver el resumen.</p>
              ) : (
                <div className="mt-2 max-h-[160px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 text-left font-medium">ProductoKey</th>
                        <th className="py-1 text-right font-medium">UND</th>
                        <th className="py-1 text-right font-medium">Ítems</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {agrupadoPorProducto.map((x) => (
                        <tr key={x.productoKey}>
                          <td className="py-1 pr-3">
                            <span className="font-mono text-[12px]">{x.productoKey}</span>
                          </td>
                          <td className="py-1 text-right font-semibold">{x.und.toLocaleString("es-CO")}</td>
                          <td className="py-1 text-right">{x.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Tabla solicitudes */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={allCheckedSol} onChange={toggleAllSol} disabled={!solItems.length} />
                        <span>Sel</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Solicitud</th>
                    <th className="px-4 py-3 text-left font-medium">Pedido</th>
                    <th className="px-4 py-3 text-left font-medium">ProductoKey</th>
                    <th className="px-4 py-3 text-right font-medium">UND</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-left font-medium">Actualización</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loadingSol && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-slate-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loadingSol && solItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-slate-500">
                        No hay solicitudes de producción en estado <b>Pendiente</b>.
                      </td>
                    </tr>
                  )}

                  {!loadingSol &&
                    solItems.map((s) => (
                      <tr key={s.solicitudProdId} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedSol[s.solicitudProdId])}
                            onChange={(e) =>
                              setSelectedSol((prev) => ({
                                ...prev,
                                [s.solicitudProdId]: e.target.checked,
                              }))
                            }
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium">{s.solicitudProdId}</div>
                          <div className="text-xs text-slate-400">
                            row Pedido: <b>{s.rowIndexPedido || "—"}</b>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium break-all">{s.pedidoKey}</div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-[12px]">{s.productoKey || "—"}</span>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {toNumberStr(s.cantidadUND).toLocaleString("es-CO")}
                        </td>

                        <td className="px-4 py-3">{s.estado || "—"}</td>

                        <td className="px-4 py-3 text-xs text-slate-500">
                          <div>Creación: {formatFechaColombia(s.fechaCreacion)}</div>
                          <div>Última: {formatFechaColombia(s.fechaUltActualizacion)}</div>
                          <div>Usuario: {s.usuario || "—"}</div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Esta tabla lee <b>SolicitudesProduccion</b> filtrando <b>estado=Pendiente</b>. Al crear OPE se asigna el mismo
              consecutivo a todos los ítems seleccionados.
            </div>
          </section>
        </>
      )}

      {/* ===========================
          TAB: PROGRAMAR OPE
         =========================== */}
      {tab === "programar" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
                <div className="flex gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Buscar OPE…"
                  />
                  <button
                    onClick={loadOpes}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    disabled={loadingOpes}
                    type="button"
                  >
                    {loadingOpes ? "Cargando…" : "Buscar"}
                  </button>
                </div>
                {errOpes && <p className="mt-2 text-sm text-rose-600">{errOpes}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  Lista OPEs cuya <b>SolicitudesProduccion</b> está en estado <b>Programado</b>.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">OPE (estado Programado)</label>
                <select
                  value={selectedOpe}
                  onChange={(e) => setSelectedOpe(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona una OPE —</option>
                  {opes.map((x) => (
                    <option key={x.ope} value={x.ope}>
                      {x.ope} — {x.items} ítems — UND {toNum(x.totalUND).toLocaleString("es-CO")}
                    </option>
                  ))}
                </select>

                <div className="mt-3 text-xs text-slate-500">
                  {loadingDetalle ? (
                    <span>Cargando detalle…</span>
                  ) : errDetalle ? (
                    <span className="text-rose-600">{errDetalle}</span>
                  ) : !detalle ? (
                    <span>Selecciona una OPE para ver los ítems.</span>
                  ) : (
                    <>
                      <div className="font-medium text-slate-700">Resumen</div>
                      <div className="mt-1">
                        Ítems: <b>{detalle.items.length}</b> · Total UND:{" "}
                        <b>{toNum(detalle.totalUND).toLocaleString("es-CO")}</b>
                      </div>
                      <div className="mt-1">
                        Estado: <b>{detalle.estado || "Programado"}</b>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Línea</label>
                    <select
                      value={lineaSel}
                      onChange={(e) => setLineaSel(e.target.value as Linea)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {LINEAS.map((l) => (
                        <option key={l} value={l}>
                          {lineaLabel(l)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Cola actual (línea seleccionada)</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <div>
                        En cola: <b>{resumenLineaSel.enCola}</b>
                      </div>
                      <div className="text-xs text-slate-500">
                        {resumenLineaSel.enCola === 0
                          ? "Sin programación."
                          : `Primera: ${resumenLineaSel.top} · Última: ${resumenLineaSel.last}`}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-slate-600">Prioridad</label>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={prioMode === "inicio"} onChange={() => setPrioMode("inicio")} />
                      Al inicio (prioridad alta)
                    </label>

                    <label className="flex items-center gap-2">
                      <input type="radio" checked={prioMode === "final"} onChange={() => setPrioMode("final")} />
                      Al final (FIFO normal)
                    </label>

                    <label className="flex items-center gap-2">
                      <input type="radio" checked={prioMode === "despues"} onChange={() => setPrioMode("despues")} />
                      Después de la posición
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={posDespues}
                        onChange={(e) => setPosDespues(Math.max(1, Math.floor(Number(e.target.value || 1))))}
                        className="w-20 rounded-xl border border-slate-300 px-2 py-1 text-right"
                        disabled={prioMode !== "despues"}
                      />
                    </label>

                    <p className="text-xs text-slate-500">Ejemplo: “Después de 1” = queda en posición 2.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={agregarACola}
                  disabled={!puedeAgregar}
                  className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Agregando…" : "Añadir a línea"}
                </button>

                {saveMsg && <p className="mt-2 text-sm">{saveMsg}</p>}
              </div>
            </div>
          </section>

          {/* Detalle items */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold">Detalle de la OPE</h2>
              <p className="mt-1 text-xs text-slate-500">
                Muestra los ítems que componen la OPE seleccionada (productoKey + UND + cliente).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ProductoKey</th>
                    <th className="px-4 py-3 text-right font-medium">UND</th>
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">PedidoKey</th>
                    <th className="px-4 py-3 text-left font-medium">Row Pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!selectedOpe && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={5}>
                        Selecciona una OPE arriba para ver su detalle.
                      </td>
                    </tr>
                  )}

                  {selectedOpe && loadingDetalle && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={5}>
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {selectedOpe && !loadingDetalle && detalle?.items?.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={5}>
                        No hay ítems para esta OPE.
                      </td>
                    </tr>
                  )}

                  {selectedOpe &&
                    !loadingDetalle &&
                    (detalle?.items || []).map((it, idx) => (
                      <tr key={`${it.productoKey}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{it.productoKey || "—"}</div>
                          <div className="text-xs text-slate-400">{it.solicitudProdId ? `sol: ${it.solicitudProdId}` : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{toNum(it.cantidadUND).toLocaleString("es-CO")}</td>
                        <td className="px-4 py-3">{it.cliente || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 break-all">{it.pedidoKey || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{it.rowIndexPedido ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Colas (vista rápida) */}
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Colas actuales (vista rápida)</h2>
                <p className="mt-1 text-xs text-slate-500">Útil para decidir prioridad antes de “Añadir a línea”.</p>
              </div>

              <button
                type="button"
                onClick={loadColas}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loadingColas}
              >
                {loadingColas ? "Actualizando…" : "Actualizar"}
              </button>
            </div>

            {errColas && <p className="mt-2 text-sm text-rose-600">{errColas}</p>}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {LINEAS.map((l) => {
                const list = sortByPos(colas[l] || []);
                return (
                  <div key={l} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{lineaLabel(l)}</div>
                      <div className="text-xs text-slate-500">{list.length} en cola</div>
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      {list.length === 0 ? (
                        <div className="text-slate-500">Sin programación.</div>
                      ) : (
                        <div className="space-y-1">
                          {list.slice(0, 3).map((x) => (
                            <div key={`${l}-${x.ope}-${x.pos}`} className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="font-medium">{x.ope}</div>
                              <div className="text-xs text-slate-500">
                                pos {x.pos} · {x.estado || "En cola"}
                              </div>
                            </div>
                          ))}
                          {list.length > 3 && <div className="text-xs text-slate-500">… y {list.length - 3} más</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ===========================
          TAB: VER PROGRAMACIÓN
         =========================== */}
      {tab === "ver" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-semibold text-slate-800">Ver programación (tipo planta)</div>
                <div className="mt-1 text-xs text-slate-500">
                  Cola por línea → OPEs en orden → expandir para ver productos/UND/cliente.
                  <span className="ml-2 text-slate-400">(Subir/Bajar cambia solo en pantalla, mañana lo persistimos.)</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadColas}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  disabled={loadingColas}
                >
                  {loadingColas ? "Actualizando…" : "Actualizar colas"}
                </button>
                <button
                  type="button"
                  onClick={() => resetOrdenLinea(verLineaSel)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Reset orden (línea)
                </button>
              </div>
            </div>

            {errColas && <p className="mt-2 text-sm text-rose-600">{errColas}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {LINEAS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setVerLineaSel(l)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    verLineaSel === l
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lineaLabel(l)}
                  <span className="ml-2 text-xs opacity-90">({(colasLocal[l] || []).length})</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium text-slate-600">Línea seleccionada</div>
                <div className="mt-1 text-lg font-semibold">{lineaLabel(verLineaSel)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium text-slate-600">OPEs en cola</div>
                <div className="mt-1 text-lg font-semibold">{colaVerSel.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium text-slate-600">UND total (cargado)</div>
                <div className="mt-1 text-lg font-semibold">{undTotalLinea.toLocaleString("es-CO")}</div>
                <div className="mt-1 text-xs text-slate-400">*Suma solo OPEs cuyo detalle ya se cargó (abre las cards).</div>
              </div>
            </div>
          </section>

          <section className="mt-4 space-y-3">
            {colaVerSel.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                No hay OPEs en cola para {lineaLabel(verLineaSel)}.
              </div>
            ) : (
              colaVerSel.map((x, idx) => {
                const isOpen = !!openOpe[x.ope];
                const cache = detalleCache[x.ope];
                const d = cache?.detalle;
                const isLoading = cache?.loading;
                const err = cache?.error;

                const totalUND = d ? toNum(d.totalUND) : undefined;
                const itemsCount = d ? (d.items || []).length : undefined;

                return (
                  <div key={`${verLineaSel}-${x.ope}-${x.pos}`} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold">{x.ope}</div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">pos {x.pos}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {x.estado || "En cola"}
                          </span>
                          {typeof totalUND === "number" && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                              UND {totalUND.toLocaleString("es-CO")}
                            </span>
                          )}
                          {typeof itemsCount === "number" && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                              {itemsCount} ítems
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {d ? (
                            <>
                              {d.items.slice(0, 2).map((it, i2) => (
                                <div key={`${x.ope}-prev-${i2}`} className="truncate">
                                  • {it.productoKey} — UND {toNum(it.cantidadUND).toLocaleString("es-CO")}
                                  {it.cliente ? ` — ${it.cliente}` : ""}
                                </div>
                              ))}
                              {d.items.length > 2 && <div className="text-slate-400">… y {d.items.length - 2} más</div>}
                            </>
                          ) : (
                            <span className="text-slate-400">Abre para cargar detalle de productos (productoKey + UND + cliente).</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => moveOpe(verLineaSel, x.ope, "up")}
                          disabled={idx === 0}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                        >
                          ↑ Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOpe(verLineaSel, x.ope, "down")}
                          disabled={idx === colaVerSel.length - 1}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                        >
                          ↓ Bajar
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleOpen(x.ope)}
                          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          {isOpen ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-4">
                        {isLoading && <div className="text-sm text-slate-500">Cargando detalle…</div>}
                        {err && <div className="text-sm text-rose-600">{err}</div>}

                        {!isLoading && !err && d && (
                          <>
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                Total UND: <b>{toNum(d.totalUND).toLocaleString("es-CO")}</b>
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                Ítems: <b>{d.items.length}</b>
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                Estado: <b>{d.estado || x.estado || "En cola"}</b>
                              </span>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                              <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                  <tr>
                                    <th className="px-4 py-3 text-left font-medium">ProductoKey</th>
                                    <th className="px-4 py-3 text-right font-medium">UND</th>
                                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                                    <th className="px-4 py-3 text-left font-medium">PedidoKey</th>
                                    <th className="px-4 py-3 text-left font-medium">Row</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {d.items.map((it, i3) => (
                                    <tr key={`${x.ope}-it-${i3}`} className="hover:bg-slate-50">
                                      <td className="px-4 py-3">
                                        <div className="font-medium">{it.productoKey || "—"}</div>
                                        <div className="text-xs text-slate-400">{it.solicitudProdId ? `sol: ${it.solicitudProdId}` : ""}</div>
                                      </td>
                                      <td className="px-4 py-3 text-right font-semibold">{toNum(it.cantidadUND).toLocaleString("es-CO")}</td>
                                      <td className="px-4 py-3">{it.cliente || "—"}</td>
                                      <td className="px-4 py-3 text-xs text-slate-500 break-all">{it.pedidoKey || "—"}</td>
                                      <td className="px-4 py-3 text-slate-600">{it.rowIndexPedido ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 text-xs text-slate-500">
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </main>
  );
}

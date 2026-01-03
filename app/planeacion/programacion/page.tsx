// app/planeacion/programacion/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TabKey = "produccion" | "corte" | "despachos";

type ProgramacionRow = {
  tab: TabKey;

  // Identificadores
  groupKey: string; // para entrar a "Programar"
  pedidoKey: string;

  // Info pedido
  consecutivo: string;
  cliente: string;
  oc: string;

  // Producto
  productoKey: string;
  productoTexto: string;

  // UND
  solicitadoUnd: number;
  reservadoUnd: number;
  porProducirUnd: number;

  // Req / Estado
  fechaRequerida: string; // ISO o YYYY-MM-DD
  estado: string; // Pendiente / Programado / etc.
};

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
    return `${day}/${month}/${year}`;
  }

  const d2 = new Date(value);
  if (!Number.isNaN(d2.getTime())) {
    const day = String(d2.getDate()).padStart(2, "0");
    const month = d2
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = d2.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return value;
}

function chipEstado(estado?: string) {
  const s = (estado || "").toLowerCase();
  if (!estado || s.includes("pend")) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        Pendiente
      </span>
    );
  }
  if (s.includes("program")) {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
        Programado
      </span>
    );
  }
  if (s.includes("ingres")) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
        Ingresado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      {estado}
    </span>
  );
}

// ✅ Mock (para ver UI sin backend)
const MOCK: ProgramacionRow[] = [
  {
    tab: "produccion",
    groupKey: "GRP|Perfíl Regleta 70|Negro|7|3.8",
    pedidoKey: "PK-001",
    consecutivo: "000123",
    cliente: "Jeronimo",
    oc: "OC-C-8899",
    productoKey: "ProdA|Rojo|50|0.998|Sin acabados",
    productoTexto: "Prod A | Rojo | 50 cm | 0,998 m | Sin acabados",
    solicitadoUnd: 49000,
    reservadoUnd: 0,
    porProducirUnd: 49000,
    fechaRequerida: "2026-01-14",
    estado: "Pendiente",
  },
  {
    tab: "produccion",
    groupKey: "GRP|Perfíl Regleta 70|Negro|7|3.8",
    pedidoKey: "PK-001",
    consecutivo: "000123",
    cliente: "Jeronimo",
    oc: "OC-C-8899",
    productoKey: "ProdB|Azul|50|0.998|Sin acabados",
    productoTexto: "Prod B | Azul | 50 cm | 0,998 m | Sin acabados",
    solicitadoUnd: 11200,
    reservadoUnd: 200,
    porProducirUnd: 11000,
    fechaRequerida: "2026-01-14",
    estado: "Pendiente",
  },
  {
    tab: "corte",
    groupKey: "CORTE|Algamar|OC27655|R3",
    pedidoKey: "Algamar|Calle 54#46-15|Itagui|27655",
    consecutivo: "000002",
    cliente: "Algamar",
    oc: "27655",
    productoKey: "Enganche|Blanco|4|0.992|Marca",
    productoTexto: "Enganche Interno Tipo Bisagra | Blanco | 4 cm | 0,992 m | Marca",
    solicitadoUnd: 200,
    reservadoUnd: 200,
    porProducirUnd: 0,
    fechaRequerida: "2026-01-13",
    estado: "Pendiente",
  },
  {
    tab: "despachos",
    groupKey: "DSP|PK-001",
    pedidoKey: "PK-001",
    consecutivo: "000123",
    cliente: "Jeronimo",
    oc: "OC-C-8899",
    productoKey: "ProdC|Negro|50|0.998|Sin acabados",
    productoTexto: "Prod C | Negro | 50 cm | 0,998 m | Sin acabados",
    solicitadoUnd: 600,
    reservadoUnd: 600,
    porProducirUnd: 0,
    fechaRequerida: "2026-01-12",
    estado: "Pendiente",
  },
];

export default function PlaneacionProgramacionPage() {
  const [tab, setTab] = useState<TabKey>("produccion");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProgramacionRow[]>([]);

  async function load() {
    setLoading(true);

    // ✅ Cuando exista backend, aquí solo cambias el endpoint.
    // Ej:
    // const res = await fetch(`/api/planeacion/programacion/list?tab=${tab}&q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
    // const json = await res.json();
    // setRows(json.items || []);
    // setLoading(false);

    // ✅ Por ahora: mock + filtro
    const all = MOCK.filter((r) => r.tab === tab);

    const qq = q.trim().toLowerCase();
    const filtered = !qq
      ? all
      : all.filter((r) => {
          const blob = [
            r.consecutivo,
            r.cliente,
            r.oc,
            r.pedidoKey,
            r.productoTexto,
            r.productoKey,
          ]
            .join(" ")
            .toLowerCase();
          return blob.includes(qq);
        });

    // Simula carga
    setTimeout(() => {
      setRows(filtered);
      setLoading(false);
    }, 150);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  const helperText = useMemo(() => {
    if (tab === "produccion") return "Muestra ítems con destino Producción o con cantidad por producir.";
    if (tab === "corte") return "Muestra ítems clasificados a Corte (y pendientes por programar).";
    return "Muestra ítems listos para Despacho (reservados/almacén) y pendientes por despachar.";
  }, [tab]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/planeacion"
        className="mb-4 inline-flex text-sm text-slate-500 hover:text-slate-700"
      >
        ← Volver
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Programación</h1>
          <p className="text-sm text-slate-500">
            Planeación programa <b>Producción</b>, <b>Corte</b> y <b>Despachos</b>.
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("produccion")}
              className={[
                "rounded-xl border px-4 py-2 text-sm",
                tab === "produccion"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              Producción
            </button>

            <button
              type="button"
              onClick={() => setTab("corte")}
              className={[
                "rounded-xl border px-4 py-2 text-sm",
                tab === "corte"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              Corte
            </button>

            <button
              type="button"
              onClick={() => setTab("despachos")}
              className={[
                "rounded-xl border px-4 py-2 text-sm",
                tab === "despachos"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              Despachos
            </button>

            <div className="ml-1 hidden text-xs text-slate-500 md:flex md:items-center">
              {helperText}
            </div>
          </div>

          {/* Search */}
          <div className="flex w-full gap-2 md:w-[520px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar por cliente, OC, consecutivo, pedidoKey o producto…"
            />
            <button
              type="button"
              onClick={load}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              disabled={loading}
            >
              {loading ? "Cargando…" : "Buscar"}
            </button>
          </div>

          {/* helper mobile */}
          <div className="text-xs text-slate-500 md:hidden">{helperText}</div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Pedido</th>
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Solicitado (UND)</th>
                <th className="px-4 py-3 text-right font-medium">Reservado (UND)</th>
                <th className="px-4 py-3 text-right font-medium">Por producir (UND)</th>
                <th className="px-4 py-3 text-left font-medium">Req</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    Cargando…
                  </td>
                </tr>
              )}

              {empty && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    No hay ítems para esta pestaña.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r, idx) => (
                  <tr key={`${r.groupKey}-${r.pedidoKey}-${r.productoKey}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.consecutivo || "—"}</div>
                      <div className="text-xs text-slate-500">{r.cliente || "—"}</div>
                      <div className="text-xs text-slate-400">
                        OC {r.oc || "—"} ·{" "}
                        <span className="font-mono">{r.pedidoKey}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">{r.productoTexto || "—"}</div>
                      <div className="text-xs text-slate-400 break-all">{r.productoKey}</div>
                    </td>

                    <td className="px-4 py-3 text-right font-medium">
                      {r.solicitadoUnd.toLocaleString("es-CO")}
                    </td>

                    <td className="px-4 py-3 text-right font-medium">
                      {r.reservadoUnd.toLocaleString("es-CO")}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {r.porProducirUnd.toLocaleString("es-CO")}
                    </td>

                    <td className="px-4 py-3">{formatFechaColombia(r.fechaRequerida)}</td>

                    <td className="px-4 py-3">{chipEstado(r.estado)}</td>

                    <td className="px-4 py-3">
                      {tab === "produccion" ? (
                        <Link
                          className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                          href={`/planeacion/programacion/produccion/${encodeURIComponent(r.groupKey)}`}
                        >
                          Programar
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                          onClick={() => alert("Este detalle lo armamos en el siguiente paso (frontend).")}
                        >
                          Programar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          UND siempre. En Producción, el botón <b>Programar</b> abre el detalle del grupo.
        </div>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ViewMode = "fechas" | "despacho" | "valores";

type PedidoDetalle = {
  pedidoKey?: string;
  pedidoId?: string;

  consecutivo: string;
  fechaSolicitud: string;
  asesor: string;
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  obsComerciales: string;
  estado: string;
  pdfPath: string;
  createdBy?: string;

  items: Array<{
    producto: string;
    cantidadUnd: string;
    cantidadM: string;
    estadoItem?: string;

    fechaEstimadaEntregaAlmacen?: string;
    fechaRealEntregaAlmacen?: string;
    fechaEstimadaDespacho?: string;
    fechaRealDespacho?: string;
    fechaEntregaRealCliente?: string;

    transporte?: string;
    guia?: string;
    factura?: string;
    remision?: string;

    precioUnitario?: string;
  }>;
};

function formatFechaColombia(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;

  const day = d.getDate().toString().padStart(2, "0");
  const month = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function toNumber(value?: string) {
  if (!value) return 0;
  const s = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number, decimals = 0) {
  return n.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMoneyCOP(n: number) {
  return `$ ${formatNumber(n, 0)}`;
}

function EstadoBadge({ value }: { value?: string }) {
  const v = (value || "—").trim();
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";
  const lower = v.toLowerCase();

  let cls = "border-slate-200 bg-slate-50 text-slate-700";
  if (lower.includes("verific")) cls = "border-amber-200 bg-amber-50 text-amber-800";
  else if (lower.includes("produ") || lower.includes("corte"))
    cls = "border-indigo-200 bg-indigo-50 text-indigo-800";
  else if (lower.includes("almac")) cls = "border-sky-200 bg-sky-50 text-sky-800";
  else if (lower.includes("desp")) cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
  else if (lower.includes("entreg")) cls = "border-green-200 bg-green-50 text-green-800";
  else if (lower.includes("cancel")) cls = "border-red-200 bg-red-50 text-red-800";

  return <span className={`${base} ${cls}`}>{v || "—"}</span>;
}

export default function VerPedidoPage() {
  const router = useRouter();
  const params = useParams<{ pedidoKey: string }>();
  const pedidoKey = decodeURIComponent(params.pedidoKey || "");

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [view, setView] = useState<ViewMode>("fechas");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const url = `/api/comercial/pedidos/detalle?pedidoKey=${encodeURIComponent(
        pedidoKey
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();

      if (!json?.success) throw new Error(json?.message || "Error cargando pedido");
      setPedido(json.pedido as PedidoDetalle);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error cargando pedido");
      setPedido(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pedidoKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoKey]);

  async function verPdf(pdfPath: string) {
    if (!pdfPath) return alert("Este pedido no tiene pdfPath guardado.");

    const res = await fetch("/api/comercial/pedidos/pdf-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfPath }),
    });

    const json = await res.json();
    if (!json?.success) return alert(json?.message || "No se pudo abrir el PDF");
    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  const totals = useMemo(() => {
    const items = pedido?.items || [];
    let totalUnd = 0;
    let totalM = 0;
    let totalCOP = 0;

    for (const it of items) {
      const und = toNumber(it.cantidadUnd);
      const m = toNumber(it.cantidadM);
      const pu = toNumber(it.precioUnitario);

      totalUnd += und;
      totalM += m;

      // total por UND (si tu precio fuera por metro, cambia a: totalCOP += m * pu)
      totalCOP += und * pu;
    }

    return { totalUnd, totalM, totalCOP };
  }, [pedido]);

  const totalItems = useMemo(() => pedido?.items?.length ?? 0, [pedido]);

  const tabBtn = (active: boolean) =>
    `rounded-2xl px-4 py-3 text-sm font-medium shadow-sm border transition ${
      active
        ? "bg-indigo-500 text-white border-indigo-500"
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/comercial")}
      >
        ← Volver al listado
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ver pedido</h1>
          <p className="text-sm text-slate-500">
            Consecutivo:{" "}
            <span className="font-medium text-slate-700">{pedido?.consecutivo || "—"}</span>
          </p>
          <p className="text-xs text-slate-400 break-all">pedidoKey: {pedidoKey || "—"}</p>
        </div>

        <div className="flex items-center gap-3">
          <button className={tabBtn(view === "fechas")} onClick={() => setView("fechas")}>
            Fechas
          </button>
          <button className={tabBtn(view === "despacho")} onClick={() => setView("despacho")}>
            Despacho
          </button>
          <button className={tabBtn(view === "valores")} onClick={() => setView("valores")}>
            Valores
          </button>

          {pedido?.pdfPath ? (
            <button
              onClick={() => verPdf(pedido.pdfPath)}
              className="ml-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Ver PDF
            </button>
          ) : (
            <button
              disabled
              className="ml-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
            >
              Sin PDF
            </button>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading && <p className="text-sm text-slate-500">Cargando…</p>}

        {!loading && err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && pedido && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="text-sm font-medium">{pedido.cliente || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">OC</p>
                  <p className="text-sm font-medium">{pedido.oc || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Asesor</p>
                  <p className="text-sm font-medium">{pedido.asesor || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Estado (pedido)</p>
                  <div className="mt-1">
                    <EstadoBadge value={pedido.estado} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha solicitud</p>
                  <p className="text-sm font-medium">{formatFechaColombia(pedido.fechaSolicitud)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha requerida</p>
                  <p className="text-sm font-medium">{formatFechaColombia(pedido.fechaRequerida)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500">Dirección</p>
                <p className="text-sm">{pedido.direccion || "—"}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Observaciones comerciales</p>
                <p className="text-sm whitespace-pre-wrap">{pedido.obsComerciales || "—"}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-xs text-slate-500">Resumen</p>
              <p className="mt-1 text-3xl font-semibold">{totalItems}</p>
              <p className="text-sm text-slate-600">items</p>

              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total und</span>
                  <span className="font-medium">{formatNumber(totals.totalUnd)} und</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total m</span>
                  <span className="font-medium">{formatNumber(totals.totalM, 1)} m</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total COP</span>
                  <span className="font-semibold">{formatMoneyCOP(totals.totalCOP)}</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-500">Creado por</p>
                <p className="text-sm">{pedido.createdBy || "—"}</p>
              </div>

              <div className="mt-3">
                <p className="text-xs text-slate-500">pdfPath</p>
                <p className="text-xs break-all text-slate-600">{pedido.pdfPath || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {!loading && pedido && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold">
              Productos — {view === "fechas" ? "Fechas" : view === "despacho" ? "Despacho" : "Valores"}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Producto</th>
                  <th className="px-4 py-3 text-right font-medium">Cant (und)</th>
                  <th className="px-4 py-3 text-right font-medium">Cant (m)</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>

                  {view === "fechas" && (
                    <>
                      <th className="px-4 py-3 text-left font-medium">Est. Entrega almacén</th>
                      <th className="px-4 py-3 text-left font-medium">Real Entrega almacén</th>
                      <th className="px-4 py-3 text-left font-medium">Est. Despacho</th>
                      <th className="px-4 py-3 text-left font-medium">Real Despacho</th>
                      <th className="px-4 py-3 text-left font-medium">Entrega real cliente</th>
                    </>
                  )}

                  {view === "despacho" && (
                    <>
                      <th className="px-4 py-3 text-left font-medium">Transporte</th>
                      <th className="px-4 py-3 text-left font-medium">Guía</th>
                      <th className="px-4 py-3 text-left font-medium">Factura</th>
                      <th className="px-4 py-3 text-left font-medium">Remisión</th>
                    </>
                  )}

                  {view === "valores" && (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Precio unit</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pedido.items.map((it, idx) => {
                  const und = toNumber(it.cantidadUnd);
                  const m = toNumber(it.cantidadM);
                  const pu = toNumber(it.precioUnitario);
                  const total = und * pu;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 whitespace-pre-wrap">{it.producto || "—"}</td>

                      <td className="px-4 py-3 text-right">{und ? formatNumber(und) : "—"}</td>
                      <td className="px-4 py-3 text-right">{m ? formatNumber(m, 1) : "—"}</td>

                      <td className="px-4 py-3">
                        <EstadoBadge value={it.estadoItem || pedido.estado} />
                      </td>

                      {view === "fechas" && (
                        <>
                          <td className="px-4 py-3">{formatFechaColombia(it.fechaEstimadaEntregaAlmacen)}</td>
                          <td className="px-4 py-3">{formatFechaColombia(it.fechaRealEntregaAlmacen)}</td>
                          <td className="px-4 py-3">{formatFechaColombia(it.fechaEstimadaDespacho)}</td>
                          <td className="px-4 py-3">{formatFechaColombia(it.fechaRealDespacho)}</td>
                          <td className="px-4 py-3">{formatFechaColombia(it.fechaEntregaRealCliente)}</td>
                        </>
                      )}

                      {view === "despacho" && (
                        <>
                          <td className="px-4 py-3">{it.transporte || "—"}</td>
                          <td className="px-4 py-3">{it.guia || "—"}</td>
                          <td className="px-4 py-3">{it.factura || "—"}</td>
                          <td className="px-4 py-3">{it.remision || "—"}</td>
                        </>
                      )}

                      {view === "valores" && (
                        <>
                          <td className="px-4 py-3 text-right">{pu ? formatMoneyCOP(pu) : "—"}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatMoneyCOP(total)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}

                <tr className="bg-slate-50">
                  <td className="px-4 py-3 font-semibold">Totales</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(totals.totalUnd)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(totals.totalM, 1)}</td>
                  <td className="px-4 py-3" />

                  {view === "fechas" && <td className="px-4 py-3" colSpan={5} />}
                  {view === "despacho" && <td className="px-4 py-3" colSpan={4} />}

                  {view === "valores" && (
                    <>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-semibold">{formatMoneyCOP(totals.totalCOP)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

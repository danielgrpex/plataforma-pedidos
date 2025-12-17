//app/comercial/pedido/[consecutivo]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
    referencia: string;
    color: string;
    ancho: string;
    largo: string;
    cantidadUnd: string;
    cantidadM: string;
    acabados: string;
    precioUnitario: string;
  }>;
};

function formatFechaColombia(value: string) {
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

export default function VerPedidoPage() {
  const router = useRouter();
  const params = useParams<{ pedidoKey: string }>();

  const pedidoKey = decodeURIComponent(params.pedidoKey || "");

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const url = `/api/comercial/pedidos/detalle?pedidoKey=${encodeURIComponent(pedidoKey)}`;
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

  const totalItems = useMemo(() => pedido?.items?.length ?? 0, [pedido]);

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
            <span className="font-medium text-slate-700">
              {pedido?.consecutivo || "—"}
            </span>
          </p>
          <p className="text-xs text-slate-400 break-all">
            pedidoKey: {pedidoKey || "—"}
          </p>
        </div>

        {pedido?.pdfPath ? (
          <button
            onClick={() => verPdf(pedido.pdfPath)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Ver PDF
          </button>
        ) : (
          <button
            disabled
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
          >
            Sin PDF
          </button>
        )}
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
                  <p className="text-xs text-slate-500">Estado</p>
                  <p className="text-sm font-medium">{pedido.estado || "—"}</p>
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
              <p className="text-sm text-slate-600">productos</p>

              <div className="mt-3">
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
            <h2 className="text-base font-semibold">Productos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Producto</th>
                  <th className="px-4 py-3 text-left font-medium">Ref</th>
                  <th className="px-4 py-3 text-left font-medium">Color</th>
                  <th className="px-4 py-3 text-left font-medium">Ancho</th>
                  <th className="px-4 py-3 text-left font-medium">Largo</th>
                  <th className="px-4 py-3 text-left font-medium">Cant (und)</th>
                  <th className="px-4 py-3 text-left font-medium">Cant (m)</th>
                  <th className="px-4 py-3 text-left font-medium">Acabados</th>
                  <th className="px-4 py-3 text-left font-medium">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedido.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{it.producto || "—"}</td>
                    <td className="px-4 py-3">{it.referencia || "—"}</td>
                    <td className="px-4 py-3">{it.color || "—"}</td>
                    <td className="px-4 py-3">{it.ancho || "—"}</td>
                    <td className="px-4 py-3">{it.largo || "—"}</td>
                    <td className="px-4 py-3">{it.cantidadUnd || "—"}</td>
                    <td className="px-4 py-3">{it.cantidadM || "—"}</td>
                    <td className="px-4 py-3">{it.acabados || "—"}</td>
                    <td className="px-4 py-3">{it.precioUnitario || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

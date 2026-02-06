// app/planeacion/pedido-flujo/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ✅ Esto evita prerender estático (Vercel no intenta exportarlo)
export const dynamic = "force-dynamic";

type PedidoItem = {
  rowIndex1Based: number;

  // ✅ En algunos endpoints puede venir vacío/undefined → lo hacemos opcional para evitar error TS
  productoKey?: string;

  producto: string;
  cantidadUnd: string;
  cantidadM: string;
  inventarioDisponibleUnd?: number;
  inventarioDisponibleM?: number;

  // ✅ NUEVO
  precioUnitario?: string;
};

type Pedido = {
  pedidoKey: string;
  consecutivo?: string;
  cliente?: string;
  oc?: string;
  fechaRequerida?: string;

  // ✅ NUEVOS
  fechaSolicitud?: string;
  direccion?: string;
  obsComerciales?: string;

  observacionesPlaneacion?: string;
  revisadoPlaneacion?: string;

  estadoPlaneacion?: string;
  estado?: string;

  items: PedidoItem[];
};

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return null;
    return json as T;
  } catch {
    return null;
  }
}

// ✅ Traemos detalle desde Comercial (PDF + fechaSolicitud + direccion + obs + precios por producto)
async function fetchComercialDetalle(pedidoKey: string): Promise<{
  pdfPath: string;
  fechaSolicitud: string;
  direccion: string;
  obsComerciales: string;
  priceByProducto: Map<string, string>;
}> {
  try {
    const res = await fetch(
      `/api/comercial/pedidos/detalle?pedidoKey=${encodeURIComponent(pedidoKey)}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success || !json?.pedido) {
      return {
        pdfPath: "",
        fechaSolicitud: "",
        direccion: "",
        obsComerciales: "",
        priceByProducto: new Map<string, string>(),
      };
    }

    const p = json.pedido;

    const priceByProducto = new Map<string, string>();
    for (const it of p.items || []) {
      const producto = String(it.producto || "").trim();
      const precio = String(it.precioUnitario || "").trim();
      if (producto && precio) priceByProducto.set(producto, precio);
    }

    return {
      pdfPath: String(p.pdfPath || ""),
      fechaSolicitud: String(p.fechaSolicitud || ""),
      direccion: String(p.direccion || ""),
      obsComerciales: String(p.obsComerciales || ""),
      priceByProducto,
    };
  } catch {
    return {
      pdfPath: "",
      fechaSolicitud: "",
      direccion: "",
      obsComerciales: "",
      priceByProducto: new Map<string, string>(),
    };
  }
}

async function verPdf(pdfPath: string) {
  if (!pdfPath) return alert("Este pedido no tiene pdfPath guardado.");

  const res = await fetch("/api/comercial/pedidos/pdf-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfPath }),
  });

  const json = await res.json().catch(() => null);
  if (!json?.success) return alert(json?.message || "No se pudo abrir el PDF");
  window.open(json.url, "_blank", "noopener,noreferrer");
}

// ✅ Formato fecha tipo 04-Ene-2026 (si viene número o string)
function formatFechaColombia(value?: string) {
  if (!value) return "—";

  // si viene como número serial de sheets convertido a string
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      const ms = Math.round((n - 25569) * 86400 * 1000);
      const d = new Date(ms);
      const day = String(d.getUTCDate()).padStart(2, "0");
      const month = d
        .toLocaleDateString("es-CO", { month: "short" })
        .replace(".", "")
        .replace(/^\w/, (c) => c.toUpperCase());
      const year = d.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  // YYYY-MM-DD (sin zona)
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

  // ISO u otro
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

function PedidoFlujoInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const pedidoKey = (sp.get("pedidoKey") || "").trim();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<"validar" | "clasificar">("validar");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  // ✅ Detalles que vienen desde Comercial
  const [pdfPath, setPdfPath] = useState<string>("");
  const [fechaSolicitud, setFechaSolicitud] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [obsComerciales, setObsComerciales] = useState<string>("");

  const isValidated = useMemo(() => {
    const s = (pedido?.revisadoPlaneacion || "").toLowerCase();
    return s === "si" || s === "sí" || s === "true" || s === "1";
  }, [pedido?.revisadoPlaneacion]);

  useEffect(() => {
    if (!pedidoKey) {
      setErr("pedidoKey es requerido.");
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setErr(null);

      // 1) Pedido desde Planeación (items + estado planeación)
      const data = await safeJsonFetch<{ success: boolean; pedido?: Pedido; message?: string }>(
        `/api/planeacion/pedido?pedidoKey=${encodeURIComponent(pedidoKey)}`
      );

      if (!mounted) return;

      if (!data?.success || !data.pedido) {
        setErr(data?.message || "No se pudo cargar el pedido.");
        setPedido(null);
        setLoading(false);
        return;
      }

      // 2) Detalle desde Comercial (pdf + fecha solicitud + dirección + observaciones + precios)
      const comercial = await fetchComercialDetalle(pedidoKey);
      if (!mounted) return;

      // 3) Enriquecer items de planeación con precio unitario (match por producto)
      const enrichedItems = (data.pedido.items || []).map((it) => ({
        ...it,
        precioUnitario: comercial.priceByProducto.get(it.producto)?.trim() || undefined,
      }));

      setPedido({
        ...data.pedido,
        items: enrichedItems,
        fechaSolicitud: comercial.fechaSolicitud,
        direccion: comercial.direccion,
        obsComerciales: comercial.obsComerciales,
      });

      setObs((data.pedido.observacionesPlaneacion || "").trim());

      setPdfPath(comercial.pdfPath);
      setFechaSolicitud(comercial.fechaSolicitud);
      setDireccion(comercial.direccion);
      setObsComerciales(comercial.obsComerciales);

      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [pedidoKey]);

  const canSubmit = useMemo(() => {
    return !!pedidoKey && obs.trim().length > 0 && !saving;
  }, [pedidoKey, obs, saving]);

  async function submit(decision: "aprobar" | "rechazar") {
    if (!pedidoKey) return;
    if (!obs.trim()) {
      alert("Escribe Observaciones Planeación (obligatorio).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/planeacion/pedido/validacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoKey,
          decision,
          observaciones: obs.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        alert(json?.message || "No se pudo guardar la validación.");
        return;
      }

      if (decision === "rechazar") {
        router.push("/planeacion");
        return;
      }

      // ✅ aprobar: recarga pedido y habilita tab clasificar (FIX TS: evitar data.pedido undefined dentro del closure)
      const data = await safeJsonFetch<{ success: boolean; pedido?: Pedido }>(
        `/api/planeacion/pedido?pedidoKey=${encodeURIComponent(pedidoKey)}`
      );

      const refreshedPedido = data?.success ? data.pedido : undefined;

      if (refreshedPedido) {
        setPedido((prev) => {
          const priceByProducto = new Map<string, string>();
          for (const it of prev?.items || []) {
            if (it.producto && it.precioUnitario) {
              priceByProducto.set(it.producto, it.precioUnitario);
            }
          }

          const mergedItems = (refreshedPedido.items || []).map((it) => ({
            ...it,
            precioUnitario: priceByProducto.get(it.producto) || undefined,
          }));

          return {
            ...refreshedPedido,
            items: mergedItems,
            // conservar extras de Comercial ya cargados
            fechaSolicitud: prev?.fechaSolicitud,
            direccion: prev?.direccion,
            obsComerciales: prev?.obsComerciales,
          };
        });
      }

      setTab("clasificar");
    } catch {
      alert("Error de red guardando validación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <button
          type="button"
          onClick={() => router.push("/planeacion")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Volver
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Pedido — Planeación</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Primero validas el PDF/ítems. Si apruebas, se habilita Clasificar.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-50 p-2">
            <button
              type="button"
              onClick={() => setTab("validar")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                tab === "validar"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-white",
              ].join(" ")}
            >
              Validar
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isValidated) return;
                setTab("clasificar");
              }}
              disabled={!isValidated}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                tab === "clasificar"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-white",
                !isValidated ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
            >
              Clasificar
            </button>
          </div>

          <div className="mt-4">
            {loading && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
                Cargando…
              </div>
            )}

            {err && !loading && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                {err}
              </div>
            )}

            {!loading && !err && pedido && tab === "validar" && (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">Documento / PDF</h2>
                        <p className="mt-1 text-xs text-neutral-500">
                          Abre el PDF (Supabase) para validar contra los ítems.
                        </p>
                      </div>

                      {pdfPath ? (
                        <button
                          onClick={() => verPdf(pdfPath)}
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

                    {/* ✅ Resumen con nuevos campos */}
                    <div className="mt-4 grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">Pedido</span>
                        <span className="font-medium">{pedido.consecutivo ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">Cliente</span>
                        <span className="font-medium">{pedido.cliente ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">OC</span>
                        <span className="font-medium">{pedido.oc ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">Fecha solicitud</span>
                        <span className="font-medium">
                          {formatFechaColombia(fechaSolicitud || pedido.fechaSolicitud)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">Fecha requerida</span>
                        <span className="font-medium">{formatFechaColombia(pedido.fechaRequerida)}</span>
                      </div>

                      <div className="mt-2 border-t border-neutral-200 pt-3">
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-600">Dirección</span>
                          <span className="font-medium text-right">
                            {direccion || pedido.direccion || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 border-t border-neutral-200 pt-3">
                        <div className="text-neutral-600 text-xs mb-1">Observaciones comerciales</div>
                        <div className="rounded-lg bg-white border border-neutral-200 p-3 text-sm text-neutral-900 whitespace-pre-wrap">
                          {obsComerciales || pedido.obsComerciales || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <h2 className="text-base font-semibold">Ítems cargados</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      Revisa referencia/color/ancho/largo/acabados y cantidades.
                    </p>

                    <div className="mt-4 space-y-3">
                      {pedido.items?.length ? (
                        pedido.items.map((it) => (
                          <div key={it.rowIndex1Based} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <div className="text-sm font-semibold text-neutral-900">{it.producto}</div>
                            <div className="mt-1 text-xs text-neutral-600">
                              UND: <span className="font-medium">{it.cantidadUnd}</span> · M:{" "}
                              <span className="font-medium">{it.cantidadM}</span>
                            </div>

                            {/* ✅ NUEVO */}
                            <div className="mt-1 text-xs text-neutral-600">
                              Precio unitario:{" "}
                              <span className="font-medium">{it.precioUnitario || "—"}</span>
                            </div>

                            <div className="mt-2 text-xs text-neutral-500">fila: {it.rowIndex1Based}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                          No hay ítems en este pedido.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <h2 className="text-base font-semibold">Validación de Planeación</h2>
                    <div className="mt-2 text-xs text-neutral-600">
                      Estado actual: <span className="font-medium">{pedido.estado ?? "—"}</span>
                    </div>

                    <label className="mt-4 block text-sm font-medium text-neutral-900">
                      Observaciones Planeación (obligatorio)
                    </label>
                    <textarea
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={6}
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      placeholder="Describe qué revisaste. Si rechazas, explica qué está mal (ítems, cantidades, medidas, etc)."
                    />

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => submit("aprobar")}
                        className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        Aprobar y habilitar Clasificar
                      </button>
                      <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => submit("rechazar")}
                        className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && !err && pedido && tab === "clasificar" && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Clasificar</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      Aquí ya puedes entrar a la pantalla original de clasificación por ítem.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/planeacion/pedido/${encodeURIComponent(pedidoKey)}`)}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Ir a clasificar ítems
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  ✅ Pedido validado. Ya puedes clasificar.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PedidoFlujoPlaneacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50">
          <main className="mx-auto w-full max-w-6xl px-6 py-8">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 text-sm text-neutral-600">
              Cargando…
            </div>
          </main>
        </div>
      }
    >
      <PedidoFlujoInner />
    </Suspense>
  );
}

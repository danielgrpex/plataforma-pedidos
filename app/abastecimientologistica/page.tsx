// app/abastecimientologistica/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TabKey = "despachos" | "proveedores" | "entregaCliente";

type EntregaClienteItem = {
  pedidosKey: string;
  pedidoRowIndex: number;

  // opcionales (depende de lo que devuelva el endpoint)
  cliente?: string;
  producto?: string;
  cantidadUnd?: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AbastecimientoLogisticaPage() {
  const [tab, setTab] = useState<TabKey>("despachos");

  // Form Entregado cliente (manual + selector)
  const [usuario, setUsuario] = useState("");
  const [pedidosKey, setPedidosKey] = useState("");
  const [pedidoRowIndex, setPedidoRowIndex] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(""); // yyyy-mm-dd (input date)
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  // Lista de ítems despachados (para confirmar entrega)
  const [itemsDespachados, setItemsDespachados] = useState<EntregaClienteItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(""); // `${pedidosKey}__${row}`

  const entregarDisabled = useMemo(() => {
    if (!usuario.trim()) return true;

    const pk = pedidosKey.trim();
    const ri = Number(pedidoRowIndex);

    if (!pk) return true;
    if (!Number.isFinite(ri) || ri <= 0) return true;
    if (!fechaEntrega) return true;

    return false;
  }, [usuario, pedidosKey, pedidoRowIndex, fechaEntrega]);

  async function loadDespachados() {
    try {
      setLoadingItems(true);
      const res = await fetch("/api/logistica/entregado-cliente", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        // No bloqueamos la UI; solo avisamos.
        console.warn("No pude cargar despachados:", data?.message);
        setItemsDespachados([]);
        setSelectedKey("");
        return;
      }

      const list: EntregaClienteItem[] = Array.isArray(data?.items) ? data.items : [];
      setItemsDespachados(list);

      // Si hay items, preselecciona el primero y llena el form
      if (list.length) {
        const first = list[0];
        const k = `${first.pedidosKey}__${first.pedidoRowIndex}`;
        setSelectedKey(k);
        setPedidosKey(first.pedidosKey || "");
        setPedidoRowIndex(String(first.pedidoRowIndex || ""));
      } else {
        setSelectedKey("");
      }
    } catch (e) {
      console.error(e);
      setItemsDespachados([]);
      setSelectedKey("");
    } finally {
      setLoadingItems(false);
    }
  }

  // Cuando entro al tab "Entregado cliente", cargo los despachados
  useEffect(() => {
    if (tab === "entregaCliente") loadDespachados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function onSelectItem(value: string) {
    setSelectedKey(value);

    const [pk, riStr] = value.split("__");
    const ri = Number(riStr);

    if (pk) setPedidosKey(pk);
    if (Number.isFinite(ri)) setPedidoRowIndex(String(ri));
  }

  async function onConfirmarEntregaCliente() {
    if (entregarDisabled) return;

    try {
      setLoading(true);

      // Convertimos yyyy-mm-dd a ISO
      const iso = new Date(`${fechaEntrega}T12:00:00`).toISOString();

      const res = await fetch("/api/logistica/entregado-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          usuario: usuario.trim(),
          pedidosKey: pedidosKey.trim(),
          pedidoRowIndex: Number(pedidoRowIndex),
          // compat: algunos endpoints usan este nombre
          fechaEntregaRealClienteISO: iso,
          // compat: otros endpoints usan este nombre
          fechaConfirmadaCliente: iso,
          observaciones: observaciones.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.message || "Error confirmando entrega cliente");
        return;
      }

      alert("✅ Pedido actualizado a ENTREGADO (cliente confirmado).");

      // reset (pero mantenemos usuario)
      setPedidosKey("");
      setPedidoRowIndex("");
      setFechaEntrega("");
      setObservaciones("");
      setSelectedKey("");

      // recargar lista para que desaparezca el ítem confirmado
      await loadDespachados();
    } catch (e: any) {
      alert(e?.message || "Error confirmando entrega cliente");
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;
    const [pk, riStr] = selectedKey.split("__");
    const ri = Number(riStr);
    return itemsDespachados.find((x) => x.pedidosKey === pk && x.pedidoRowIndex === ri) || null;
  }, [selectedKey, itemsDespachados]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border bg-slate-50 shadow-sm">
                <span className="text-sm font-semibold text-slate-700">GR</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    Abastecimiento y logística
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                    Módulo
                  </span>
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Abastecimiento y logística
                </h1>
                <p className="text-sm text-slate-600">
                  Entradas de proveedores + despachos + confirmación de entrega al cliente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Inicio
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <TabButton active={tab === "despachos"} onClick={() => setTab("despachos")}>
              1) Despachos
            </TabButton>
            <TabButton active={tab === "entregaCliente"} onClick={() => setTab("entregaCliente")}>
              2) Entregado cliente
            </TabButton>
            <TabButton active={tab === "proveedores"} onClick={() => setTab("proveedores")}>
              3) Ingreso proveedores
            </TabButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          {/* Main */}
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            {tab === "despachos" && (
              <section>
                <HeaderBlock
                  title="Despachos desde almacén"
                  subtitle="Ver ítems listos en almacén y despachar (parcial o total) con trazabilidad."
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href="/abastecimientologistica/despachos"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Ir a Despachos
                  </Link>

                  <button
                    type="button"
                    onClick={() => setTab("entregaCliente")}
                    className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Confirmar entrega cliente
                  </button>

                  <span className="text-xs text-slate-500">
                    Siguiente: historial por pedido/item + impresión guía/remisión.
                  </span>
                </div>

                <Divider />

                <div className="grid gap-3 md:grid-cols-2">
                  <FeatureCard
                    title="Trazabilidad"
                    desc="Cada salida genera registro en Despachos y Movimiento de Inventario."
                    badge="Listo"
                  />
                  <FeatureCard
                    title="Parcial / total"
                    desc="Despachos parciales acumulados por pedido + row."
                    badge="Listo"
                  />
                </div>
              </section>
            )}

            {tab === "entregaCliente" && (
              <section>
                <HeaderBlock
                  title="Entregado al cliente"
                  subtitle="Selecciona ítems en estado Despachado, registra la fecha y marca como Entregado."
                />

                {/* Selector (automático) */}
                <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">Ítems despachados (pendientes por confirmar)</div>
                    <button
                      type="button"
                      onClick={loadDespachados}
                      className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {loadingItems ? "Cargando..." : "Refrescar"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Selecciona ítem (Despachado)">
                      <select
                        value={selectedKey}
                        onChange={(e) => onSelectItem(e.target.value)}
                        disabled={loadingItems}
                        className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-slate-300"
                      >
                        {!itemsDespachados.length ? (
                          <option value="">No hay ítems en estado Despachado</option>
                        ) : (
                          itemsDespachados.map((it) => {
                            const k = `${it.pedidosKey}__${it.pedidoRowIndex}`;
                            const labelLeft = `row ${it.pedidoRowIndex}`;
                            const labelMid = it.producto ? ` · ${it.producto}` : "";
                            const labelRight = it.cliente ? ` · ${it.cliente}` : "";
                            return (
                              <option key={k} value={k}>
                                {labelLeft}
                                {labelMid}
                                {labelRight}
                              </option>
                            );
                          })
                        )}
                      </select>

                      <p className="mt-1 text-xs text-slate-500">
                        Fuente: <span className="font-mono">/api/logistica/entregado-cliente</span> (GET)
                      </p>
                    </Field>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-xs font-medium text-slate-600">Resumen</div>
                      <div className="mt-2 text-sm text-slate-900">
                        {selectedItem ? (
                          <>
                            <div>
                              <span className="font-semibold">Row:</span> {selectedItem.pedidoRowIndex}
                            </div>
                            <div className="mt-1 break-all">
                              <span className="font-semibold">pedidosKey:</span> {selectedItem.pedidosKey}
                            </div>
                            {(selectedItem.producto || selectedItem.cliente) && (
                              <div className="mt-2 text-sm text-slate-700">
                                {selectedItem.producto ? <div><b>Producto:</b> {selectedItem.producto}</div> : null}
                                {selectedItem.cliente ? <div><b>Cliente:</b> {selectedItem.cliente}</div> : null}
                                {typeof selectedItem.cantidadUnd === "number" ? (
                                  <div><b>Cantidad:</b> {selectedItem.cantidadUnd}</div>
                                ) : null}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-slate-600">Selecciona un ítem para ver el detalle.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form (se auto-llena con el selector, pero se puede editar manualmente) */}
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Field label="Usuario (logística)">
                    <input
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: sebastian"
                    />
                  </Field>

                  <Field label="Fecha confirmada por cliente">
                    <input
                      type="date"
                      value={fechaEntrega}
                      onChange={(e) => setFechaEntrega(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Se guarda en <span className="font-medium">Pedidos → “Fecha Entrega Real Cliente”</span>.
                    </p>
                  </Field>

                  <Field label="pedidosKey (tal cual en Pedidos)">
                    <input
                      value={pedidosKey}
                      onChange={(e) => setPedidosKey(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder='Ej: Cencosud|Km 2.5 Via Chia - Cajica, ...|3000255379'
                    />
                  </Field>

                  <Field label="pedidoRowIndex (fila real en Pedidos, ej: 51)">
                    <input
                      value={pedidoRowIndex}
                      onChange={(e) => setPedidoRowIndex(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      inputMode="numeric"
                      placeholder="Ej: 51"
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <Field label="Observaciones (opcional)">
                    <input
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                      placeholder="Ej: recibido completo, firmado por cliente..."
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onConfirmarEntregaCliente}
                    disabled={entregarDisabled || loading}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                      entregarDisabled || loading
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    )}
                  >
                    {loading ? "Guardando..." : "Actualizar a Entregado"}
                  </button>

                  <span className="text-xs text-slate-500">
                    Actualiza <span className="font-medium">Pedidos → Estado</span> y{" "}
                    <span className="font-medium">Fecha Entrega Real Cliente</span>.
                  </span>
                </div>

                <Divider />

                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  <b>Nota:</b> Por defecto seleccionas desde la lista (sin copiar/pegar). Si algún día el ítem no aparece,
                  puedes registrar manualmente con pedidosKey + rowIndex.
                </div>
              </section>
            )}

            {tab === "proveedores" && (
              <section>
                <HeaderBlock
                  title="Ingreso de proveedores"
                  subtitle="Registrar materia prima / insumos / productos que entran y alimentan inventario."
                />

                <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Aquí vamos a crear:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Recepciones (factura/proveedor/lote/ubicación)</li>
                    <li>MovimientosInventario (Ingreso)</li>
                    <li>Actualización de Inventario (disponible/reservado)</li>
                  </ul>
                </div>
              </section>
            )}
          </div>

          {/* Side */}
          <div className="space-y-4">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Checklist logística</div>
                  <div className="text-sm text-slate-600">Cierre de ciclo por pedido.</div>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">PEX</span>
              </div>

              <ol className="mt-4 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    1
                  </span>
                  Despacha desde <span className="font-medium">Almacén</span> (parcial o total).
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    2
                  </span>
                  Guarda documentos (<span className="font-medium">guía, remisión, factura</span>).
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    3
                  </span>
                  Cliente confirma recepción → marca <span className="font-medium">Entregado</span>.
                </li>
              </ol>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-3 text-xs text-slate-600">
                Tip: la confirmación actualiza{" "}
                <span className="font-medium">Pedidos (Estado + Fecha Entrega Real Cliente)</span>.
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Atajos</div>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/abastecimientologistica/despachos"
                  className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ir a Despachos
                </Link>
                <button
                  type="button"
                  onClick={() => setTab("entregaCliente")}
                  className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Entregado cliente
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 rounded-3xl border bg-white p-5 text-sm text-slate-700 shadow-sm">
          <b>Nota:</b> El 404 te salía porque el menú usa la ruta con guion: <code>/abastecimiento-logistica</code>. Ya
          quedó cubierta y redirige a <code>/abastecimientologistica</code>.
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
  return <div className="my-6 h-px w-full bg-slate-200" />;
}

function FeatureCard({ title, desc, badge }: { title: string; desc: string; badge: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{badge}</span>
      </div>
      <div className="mt-2 text-sm text-slate-600">{desc}</div>
    </div>
  );
}

//app/abastecimientologistica/_components/ConfirmarEntregaTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HeaderBlock, Field } from "./ui";

type EntregaClienteItem = {
  pedidosKey: string;
  pedidoRowIndex: number;
  cliente?: string;
  producto?: string;
  cantidadUnd?: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return null;
    return json as T;
  } catch {
    return null;
  }
}

export function ConfirmarEntregaTab() {
  // Form Entregado cliente (manual + selector)
  const [usuario, setUsuario] = useState("");
  const [pedidosKey, setPedidosKey] = useState("");
  const [pedidoRowIndex, setPedidoRowIndex] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(""); // yyyy-mm-dd
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

      // Esperamos { success, items } como tu endpoint actual
      const data = await safeJson<{ success: boolean; items: EntregaClienteItem[]; message?: string }>(
        "/api/logistica/entregado-cliente"
      );

      if (!data?.success) {
        console.warn("No pude cargar despachados:", data?.message);
        setItemsDespachados([]);
        setSelectedKey("");
        return;
      }

      const list = Array.isArray(data.items) ? data.items : [];
      setItemsDespachados(list);

      // Preselecciona el primero y llena el form
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

  useEffect(() => {
    loadDespachados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // yyyy-mm-dd -> ISO
      const iso = new Date(`${fechaEntrega}T12:00:00`).toISOString();

      const res = await fetch("/api/logistica/entregado-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          usuario: usuario.trim(),
          pedidosKey: pedidosKey.trim(),
          pedidoRowIndex: Number(pedidoRowIndex),
          // compat (por si tu backend usa uno u otro)
          fechaEntregaRealClienteISO: iso,
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
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Confirmar entrega al cliente"
        subtitle="Selecciona ítems en estado Despachado, registra la fecha y marca como Entregado."
      />

      {/* Selector */}
      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-neutral-900">
            Ítems despachados (pendientes por confirmar)
          </div>

          <button
            type="button"
            onClick={loadDespachados}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-neutral-50"
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
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
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

            <p className="mt-1 text-xs text-neutral-500">
              Fuente: <span className="font-mono">/api/logistica/entregado-cliente</span> (GET)
            </p>
          </Field>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-medium text-neutral-600">Resumen</div>
            <div className="mt-2 text-sm text-neutral-900">
              {selectedItem ? (
                <>
                  <div>
                    <span className="font-semibold">Row:</span> {selectedItem.pedidoRowIndex}
                  </div>
                  <div className="mt-1 break-all">
                    <span className="font-semibold">pedidosKey:</span> {selectedItem.pedidosKey}
                  </div>

                  {(selectedItem.producto || selectedItem.cliente) && (
                    <div className="mt-2 text-sm text-neutral-700">
                      {selectedItem.producto ? (
                        <div>
                          <b>Producto:</b> {selectedItem.producto}
                        </div>
                      ) : null}
                      {selectedItem.cliente ? (
                        <div>
                          <b>Cliente:</b> {selectedItem.cliente}
                        </div>
                      ) : null}
                      {typeof selectedItem.cantidadUnd === "number" ? (
                        <div>
                          <b>Cantidad:</b> {selectedItem.cantidadUnd}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-neutral-600">Selecciona un ítem para ver el detalle.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Usuario (logística)">
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Ej: sebastian"
          />
        </Field>

        <Field label="Fecha confirmada por cliente">
          <input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Se guarda en Pedidos → <span className="font-medium">“Fecha Entrega Real Cliente”</span>.
          </p>
        </Field>

        <Field label="pedidosKey (tal cual en Pedidos)">
          <input
            value={pedidosKey}
            onChange={(e) => setPedidosKey(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder='Ej: Cencosud|Km 2.5 Via Chia - Cajica, ...|3000255379'
          />
        </Field>

        <Field label="pedidoRowIndex (fila real en Pedidos, ej: 51)">
          <input
            value={pedidoRowIndex}
            onChange={(e) => setPedidoRowIndex(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
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
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Ej: recibido completo, firmado por cliente..."
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onConfirmarEntregaCliente}
          disabled={entregarDisabled || loading}
          className={cx(
            "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium shadow-sm",
            entregarDisabled || loading
              ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
              : "bg-neutral-900 text-white hover:bg-neutral-800"
          )}
        >
          {loading ? "Guardando..." : "Marcar como Entregado"}
        </button>

        <span className="text-xs text-neutral-500">
          Actualiza Pedidos → <span className="font-medium">Estado</span> y{" "}
          <span className="font-medium">Fecha Entrega Real Cliente</span>.
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <b>Nota:</b> Por defecto seleccionas desde la lista (sin copiar/pegar). Si algún día el ítem no aparece, puedes
        registrar manualmente con pedidosKey + rowIndex.
      </div>
    </section>
  );
}

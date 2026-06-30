"use client";

import { useEffect, useMemo, useState } from "react";
import { HeaderBlock, Field } from "./ui";

type EntregaClienteItem = {
  pedidosKey: string;
  pedidoRowIndex: number;
  cliente?: string;
  ordenCompra?: string;
  producto?: string;
  cantidadUnd?: number;
  cantidadM?: number;
};

type PedidoCompleto = {
  pedidosKey: string;
  cliente?: string;
  ordenCompra?: string;
  direccion?: string;
  itemCount: number;
  rows: number[];
  totalUnd: number;
  totalM: number;
};

type ModoConfirmacion = "item" | "pedidoCompleto";

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
  const [modo, setModo] = useState<ModoConfirmacion>("item");

  const [usuario, setUsuario] = useState("");
  const [pedidosKey, setPedidosKey] = useState("");
  const [pedidoRowIndex, setPedidoRowIndex] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  const [soporteFile, setSoporteFile] = useState<File | null>(null);

  const [itemsDespachados, setItemsDespachados] = useState<EntregaClienteItem[]>([]);
  const [pedidosCompletos, setPedidosCompletos] = useState<PedidoCompleto[]>([]);

  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPedidoKey, setSelectedPedidoKey] = useState("");

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;

    const [pk, riStr] = selectedKey.split("__");
    const ri = Number(riStr);

    return (
      itemsDespachados.find(
        (x) => x.pedidosKey === pk && x.pedidoRowIndex === ri
      ) || null
    );
  }, [selectedKey, itemsDespachados]);

  const selectedPedido = useMemo(() => {
    if (!selectedPedidoKey) return null;
    return pedidosCompletos.find((x) => x.pedidosKey === selectedPedidoKey) || null;
  }, [selectedPedidoKey, pedidosCompletos]);

  const entregarDisabled = useMemo(() => {
    if (!usuario.trim()) return true;
    if (!fechaEntrega) return true;

    if (modo === "item") {
      const pk = pedidosKey.trim();
      const ri = Number(pedidoRowIndex);

      if (!pk) return true;
      if (!Number.isFinite(ri) || ri <= 0) return true;
    }

    if (modo === "pedidoCompleto") {
      if (!pedidosKey.trim()) return true;
      if (!selectedPedido) return true;
    }

    return false;
  }, [usuario, fechaEntrega, modo, pedidosKey, pedidoRowIndex, selectedPedido]);

  async function loadDespachados() {
    try {
      setLoadingItems(true);

      const data = await safeJson<{
        success: boolean;
        items: EntregaClienteItem[];
        pedidosCompletos?: PedidoCompleto[];
        message?: string;
      }>("/api/logistica/entregado-cliente");

      if (!data?.success) {
        console.warn("No pude cargar despachados:", data?.message);
        setItemsDespachados([]);
        setPedidosCompletos([]);
        setSelectedKey("");
        setSelectedPedidoKey("");
        return;
      }

      const itemList = Array.isArray(data.items) ? data.items : [];
      const pedidoList = Array.isArray(data.pedidosCompletos)
        ? data.pedidosCompletos
        : [];

      setItemsDespachados(itemList);
      setPedidosCompletos(pedidoList);

      if (modo === "item" && itemList.length) {
        const first = itemList[0];
        const k = `${first.pedidosKey}__${first.pedidoRowIndex}`;

        setSelectedKey(k);
        setPedidosKey(first.pedidosKey || "");
        setPedidoRowIndex(String(first.pedidoRowIndex || ""));
      }

      if (modo === "pedidoCompleto" && pedidoList.length) {
        const first = pedidoList[0];

        setSelectedPedidoKey(first.pedidosKey);
        setPedidosKey(first.pedidosKey || "");
        setPedidoRowIndex("");
      }
    } catch (e) {
      console.error(e);
      setItemsDespachados([]);
      setPedidosCompletos([]);
      setSelectedKey("");
      setSelectedPedidoKey("");
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadDespachados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarFormularioDespuesDeGuardar() {
    setPedidosKey("");
    setPedidoRowIndex("");
    setFechaEntrega("");
    setObservaciones("");
    setSelectedKey("");
    setSelectedPedidoKey("");
    setSoporteFile(null);

    const input = document.getElementById("soporteEntregaFile") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function onChangeModo(nextModo: ModoConfirmacion) {
    setModo(nextModo);
    setPedidosKey("");
    setPedidoRowIndex("");
    setSelectedKey("");
    setSelectedPedidoKey("");

    if (nextModo === "item" && itemsDespachados.length) {
      const first = itemsDespachados[0];
      const k = `${first.pedidosKey}__${first.pedidoRowIndex}`;

      setSelectedKey(k);
      setPedidosKey(first.pedidosKey || "");
      setPedidoRowIndex(String(first.pedidoRowIndex || ""));
    }

    if (nextModo === "pedidoCompleto" && pedidosCompletos.length) {
      const first = pedidosCompletos[0];

      setSelectedPedidoKey(first.pedidosKey);
      setPedidosKey(first.pedidosKey || "");
      setPedidoRowIndex("");
    }
  }

  function onSelectItem(value: string) {
    setSelectedKey(value);

    const [pk, riStr] = value.split("__");
    const ri = Number(riStr);

    if (pk) setPedidosKey(pk);
    if (Number.isFinite(ri)) setPedidoRowIndex(String(ri));
  }

  function onSelectPedidoCompleto(value: string) {
    setSelectedPedidoKey(value);
    setPedidosKey(value || "");
    setPedidoRowIndex("");
  }

  async function subirSoporteSiExiste() {
    if (!soporteFile) {
      return {
        soporteEntregaUrl: "",
        soporteEntregaNombre: "",
      };
    }

    const form = new FormData();
    form.append("file", soporteFile);
    form.append("pedidosKey", pedidosKey.trim());
    form.append("pedidoRowIndex", modo === "item" ? pedidoRowIndex.trim() : "pedido-completo");
    form.append("uploadedBy", usuario.trim());

    const res = await fetch("/api/logistica/soporte-entrega", {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Error subiendo soporte de entrega");
    }

    return {
      soporteEntregaUrl: data.soporte?.file_url || "",
      soporteEntregaNombre: data.soporte?.file_name || soporteFile.name,
    };
  }

  async function onConfirmarEntregaCliente() {
    if (entregarDisabled) return;

    try {
      setLoading(true);

      const iso = new Date(`${fechaEntrega}T12:00:00`).toISOString();

      const soporte = await subirSoporteSiExiste();

      const body: any = {
        modo,
        usuario: usuario.trim(),
        pedidosKey: pedidosKey.trim(),
        fechaEntregaRealClienteISO: iso,
        fechaConfirmadaCliente: iso,
        observaciones: observaciones.trim(),
        soporteEntregaUrl: soporte.soporteEntregaUrl,
        soporteEntregaNombre: soporte.soporteEntregaNombre,
      };

      if (modo === "item") {
        body.pedidoRowIndex = Number(pedidoRowIndex);
      }

      const res = await fetch("/api/logistica/entregado-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        alert(data?.message || "Error confirmando entrega cliente");
        return;
      }

      if (modo === "pedidoCompleto") {
        alert(`✅ Pedido completo actualizado a ENTREGADO. Filas actualizadas: ${data.filasActualizadas || ""}`);
      } else {
        alert("✅ Ítem actualizado a ENTREGADO.");
      }

      limpiarFormularioDespuesDeGuardar();
      await loadDespachados();
    } catch (e: any) {
      alert(e?.message || "Error confirmando entrega cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Confirmar entrega al cliente"
        subtitle="Confirma por ítem o por pedido completo cuando todos los ítems ya estén despachados."
      />

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-sm font-semibold text-neutral-900">
          Modo de confirmación
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeModo("item")}
            className={cx(
              "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium shadow-sm",
              modo === "item"
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            Confirmar por ítem
          </button>

          <button
            type="button"
            onClick={() => onChangeModo("pedidoCompleto")}
            className={cx(
              "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium shadow-sm",
              modo === "pedidoCompleto"
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            Confirmar pedido completo
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-neutral-900">
            {modo === "item"
              ? "Ítems despachados pendientes por confirmar"
              : "Pedidos completos listos para confirmar entrega"}
          </div>

          <button
            type="button"
            onClick={loadDespachados}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            {loadingItems ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {modo === "item" ? (
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
                Fuente: <span className="font-mono">/api/logistica/entregado-cliente</span> GET
              </p>
            </Field>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-medium text-neutral-600">Resumen</div>

              <div className="mt-2 text-sm text-neutral-900">
                {selectedItem ? (
                  <>
                    <div>
                      <span className="font-semibold">Row:</span>{" "}
                      {selectedItem.pedidoRowIndex}
                    </div>

                    <div className="mt-1 break-all">
                      <span className="font-semibold">pedidosKey:</span>{" "}
                      {selectedItem.pedidosKey}
                    </div>

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
                          <b>Cantidad und:</b> {selectedItem.cantidadUnd}
                        </div>
                      ) : null}

                      {typeof selectedItem.cantidadM === "number" ? (
                        <div>
                          <b>Cantidad m:</b> {selectedItem.cantidadM}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-neutral-600">
                    Selecciona un ítem para ver el detalle.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Selecciona pedido completo">
              <select
                value={selectedPedidoKey}
                onChange={(e) => onSelectPedidoCompleto(e.target.value)}
                disabled={loadingItems}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              >
                {!pedidosCompletos.length ? (
                  <option value="">
                    No hay pedidos completos listos para confirmar
                  </option>
                ) : (
                  pedidosCompletos.map((p) => {
  const primeraFila = p.rows?.[0];
  const ultimaFila = p.rows?.[p.rows.length - 1];

  const rangoFilas =
    primeraFila && ultimaFila
      ? primeraFila === ultimaFila
        ? ` · fila ${primeraFila}`
        : ` · filas ${primeraFila}-${ultimaFila}`
      : "";

  return (
    <option key={p.pedidosKey} value={p.pedidosKey}>
      {p.cliente || "Sin cliente"} · OC {p.ordenCompra || "Sin OC"} ·{" "}
      {p.direccion || "Sin dirección"} · {p.itemCount} ítem(s)
      {rangoFilas}
    </option>
  );
})
                )}
              </select>

              <p className="mt-1 text-xs text-neutral-500">
                Solo aparecen pedidos donde todos los ítems están en estado Despachado.
              </p>
            </Field>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-medium text-neutral-600">Resumen pedido</div>

              <div className="mt-2 text-sm text-neutral-900">
                {selectedPedido ? (
                  <>
                    <div>
                      <span className="font-semibold">Cliente:</span>{" "}
                      {selectedPedido.cliente || "—"}
                    </div>

                    <div>
  <span className="font-semibold">OC:</span>{" "}
  {selectedPedido.ordenCompra || "—"}
</div>

<div>
  <span className="font-semibold">Dirección:</span>{" "}
  {selectedPedido.direccion || "—"}
</div>

<div>
  <span className="font-semibold">Ítems:</span>{" "}
  {selectedPedido.itemCount}
</div>

{selectedPedido.rows?.length ? (
  <div>
    <span className="font-semibold">Filas:</span>{" "}
    {selectedPedido.rows.join(", ")}
  </div>
) : null}

                    <div>
                      <span className="font-semibold">Total und:</span>{" "}
                      {selectedPedido.totalUnd}
                    </div>

                    <div>
                      <span className="font-semibold">Total m:</span>{" "}
                      {selectedPedido.totalM}
                    </div>

                    <div className="mt-2 break-all text-xs text-neutral-600">
                      <span className="font-semibold">pedidosKey:</span>{" "}
                      {selectedPedido.pedidosKey}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-neutral-600">
                    Selecciona un pedido para ver el detalle.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

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
            Se guarda en Pedidos →{" "}
            <span className="font-medium">Fecha Entrega Real Cliente</span>.
          </p>
        </Field>

        <Field label="pedidosKey">
          <input
            value={pedidosKey}
            onChange={(e) => setPedidosKey(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Se llena automáticamente al seleccionar"
          />
        </Field>

        {modo === "item" ? (
          <Field label="pedidoRowIndex">
            <input
              value={pedidoRowIndex}
              onChange={(e) => setPedidoRowIndex(e.target.value)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              inputMode="numeric"
              placeholder="Ej: 51"
            />
          </Field>
        ) : (
          <Field label="Confirmación">
            <div className="flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-600">
              Se actualizarán todos los ítems del pedido seleccionado.
            </div>
          </Field>
        )}
      </div>

      <div className="mt-3">
        <Field label="Observaciones entrega cliente (opcional)">
          <input
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Ej: soporte recibido, guía firmada, entregado completo..."
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Documento soporte de entrega (opcional)">
          <input
            id="soporteEntregaFile"
            type="file"
            onChange={(e) => setSoporteFile(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />

          <p className="mt-1 text-xs text-neutral-500">
            Puedes subir guía firmada, comprobante de transportadora, acta o soporte recibido por el cliente.
          </p>
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
          {loading
            ? soporteFile
              ? "Subiendo soporte y guardando..."
              : "Guardando..."
            : modo === "pedidoCompleto"
              ? "Marcar pedido completo como Entregado"
              : "Marcar ítem como Entregado"}
        </button>

        <span className="text-xs text-neutral-500">
          Actualiza Pedidos → Estado, Fecha Entrega Real Cliente y soporte opcional.
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <b>Nota:</b> Si confirmas por pedido completo, el sistema actualiza todas las filas del mismo pedido.
        Solo aparecerán pedidos completos cuando todos sus ítems estén en estado Despachado.
      </div>
    </section>
  );
}
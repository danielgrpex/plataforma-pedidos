"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Catalogos = {
  clientes: string[];
  referencias: string[];
  colores: string[];
  anchos: string[];
  acabados: string[];
  vendedores: string[];
};

type ItemForm = {
  id: string;
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  cantidad: string;
  acabados: string[];
  precioUnitario: string;
};

const emptyCats: Catalogos = {
  clientes: [],
  referencias: [],
  colores: [],
  anchos: [],
  acabados: [],
  vendedores: [],
};

const uid = () => "r_" + Math.random().toString(36).slice(2, 9);

export default function NuevoPedidoPage() {
  const router = useRouter();

  const [cats, setCats] = useState<Catalogos>(emptyCats);
  const [loadingCats, setLoadingCats] = useState(true);

  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [oc, setOc] = useState("");
  const [fechaReq, setFechaReq] = useState("");
  const [asesor, setAsesor] = useState("");
  const [obs, setObs] = useState("");
  const [esAdicional, setEsAdicional] = useState(false);

  const [items, setItems] = useState<ItemForm[]>([
    {
      id: uid(),
      referencia: "",
      color: "",
      ancho: "",
      largo: "",
      cantidad: "",
      acabados: [],
      precioUnitario: "",
    },
  ]);

  const [ocFile, setOcFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // === Cargar catálogos ===
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCats(true);
        const res = await fetch("/api/comercial/catalogos");
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Catalogos;
        setCats(data);
      } catch (e: any) {
        console.error(e);
        setErr(
          e?.message ||
            "Error cargando catálogos. Revisa la conexión con Google Sheets."
        );
      } finally {
        setLoadingCats(false);
      }
    };
    load();
  }, []);

  // === Helpers ===
  const updateItem = (id: string, patch: Partial<ItemForm>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const toggleAcabado = (id: string, acabado: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const exists = it.acabados.includes(acabado);
        return {
          ...it,
          acabados: exists
            ? it.acabados.filter((a) => a !== acabado)
            : [...it.acabados, acabado],
        };
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        referencia: "",
        color: "",
        ancho: "",
        largo: "",
        cantidad: "",
        acabados: [],
        precioUnitario: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.id !== id)));
  };

  // === Validaciones rápidas frontend (el backend igual valida) ===
  const validarCabecera = () => {
    if (!cliente.trim()) return 'El campo "Cliente" es obligatorio.';
    if (!asesor.trim()) return 'El campo "Asesor comercial" es obligatorio.';
    if (!direccion.trim())
      return 'El campo "Dirección de despacho" es obligatorio.';
    if (!oc.trim()) return 'El campo "N° Orden de Compra / Cotización" es obligatorio.';
    if (!fechaReq.trim())
      return 'El campo "Fecha requerida de entrega" es obligatorio.';
    if (!ocFile) return "Debes adjuntar el PDF de la OC/cotización.";
    return "";
  };

  const validarItems = () => {
    if (!items.length) return "Debes agregar al menos un producto.";
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const n = i + 1;
      if (!it.referencia.trim())
        return `Referencia obligatoria en producto ${n}`;
      if (!it.color.trim()) return `Color obligatorio en producto ${n}`;
      if (!it.ancho.trim()) return `Ancho obligatorio en producto ${n}`;
      if (!(Number(it.largo) > 0))
        return `Largo (m) debe ser > 0 en producto ${n}`;
      if (!(Number(it.cantidad) > 0))
        return `Cantidad (und) debe ser > 0 en producto ${n}`;
      if (!(Number(it.precioUnitario) > 0))
        return `Precio unitario debe ser > 0 en producto ${n}`;
    }
    return "";
  };

  const fileToDataUrl = (file: File): Promise<{ name: string; dataUrl: string }> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () =>
        resolve({
          name: file.name,
          dataUrl: fr.result as string,
        });
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  // === Submit ===
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    const errCab = validarCabecera();
    if (errCab) {
      setErr(errCab);
      return;
    }

    const errItems = validarItems();
    if (errItems) {
      setErr(errItems);
      return;
    }

    if (!ocFile) {
      setErr("Debes adjuntar el PDF de la OC/cotización.");
      return;
    }

    try {
      setSaving(true);
      setMsg("Guardando pedido…");

      const ocPdf = await fileToDataUrl(ocFile);

      const payload = {
        cabecera: {
          cliente: cliente.trim(),
          direccion: direccion.trim(),
          oc: oc.trim(),
          fechaRequerida: fechaReq,
          asesor: asesor.trim(),
          obs: obs.trim(),
          fechaSolicitud: new Date().toISOString(),
          esAdicional,
        },
        items: items.map((it) => ({
          referencia: it.referencia.trim(),
          color: it.color.trim(),
          ancho: it.ancho.trim(),
          largo: it.largo.trim(),
          cantidad: it.cantidad.trim(),
          acabados: it.acabados,
          precioUnitario: it.precioUnitario.trim(),
        })),
        files: { ocPdf },
      };

      const res = await fetch("/api/comercial/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al guardar pedido");
      }

      // Reset básico
      setCliente("");
      setDireccion("");
      setOc("");
      setFechaReq("");
      setAsesor("");
      setObs("");
      setEsAdicional(false);
      setOcFile(null);
      setItems([
        {
          id: uid(),
          referencia: "",
          color: "",
          ancho: "",
          largo: "",
          cantidad: "",
          acabados: [],
          precioUnitario: "",
        },
      ]);

      setMsg("✅ Pedido guardado correctamente.");
      // Opcional: volver al listado después de unos segundos
      // setTimeout(() => router.push("/comercial"), 1500);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error al guardar pedido.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  // === UI ===
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/comercial")}
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-semibold mb-1">Nuevo pedido comercial</h1>
      <p className="text-sm text-slate-500 mb-6">
        Diligencia la información base del pedido. En el siguiente paso conectaremos
        esto con Google Sheets.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                disabled={loadingCats}
              >
                <option value="">Seleccione</option>
                {cats.clientes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Dirección de despacho
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                N° Orden de Compra / Cotización
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={oc}
                onChange={(e) => setOc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Fecha requerida de entrega
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={fechaReq}
                onChange={(e) => setFechaReq(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Asesor Comercial
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={asesor}
                onChange={(e) => setAsesor(e.target.value)}
                disabled={loadingCats}
              >
                <option value="">Seleccione</option>
                {cats.vendedores.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-start gap-2">
              <input
                id="esAdicional"
                type="checkbox"
                className="mt-1"
                checked={esAdicional}
                onChange={(e) => setEsAdicional(e.target.checked)}
              />
              <div>
                <label
                  htmlFor="esAdicional"
                  className="text-sm font-medium cursor-pointer"
                >
                  Adicional de esta misma OC (mismo cliente)
                </label>
                <p className="text-xs text-slate-500">
                  Si marcas esto, se permitirá registrar más productos con el mismo Nº
                  de OC y se reutilizará la carpeta existente.
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                PDF OC/Cotización (obligatorio)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setOcFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Sube solo 1 PDF obligatorio.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Observaciones
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[80px]"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Productos */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Productos</h2>
            <button
              type="button"
              className="rounded-xl border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
              onClick={addItem}
            >
              + Agregar producto
            </button>
          </div>

          <div className="space-y-4">
            {items.map((it, index) => (
              <div
                key={it.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Producto #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => removeItem(it.id)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Referencia
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.referencia}
                      onChange={(e) =>
                        updateItem(it.id, { referencia: e.target.value })
                      }
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.referencias.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Color
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.color}
                      onChange={(e) =>
                        updateItem(it.id, { color: e.target.value })
                      }
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.colores.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Ancho (cm)
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.ancho}
                      onChange={(e) =>
                        updateItem(it.id, { ancho: e.target.value })
                      }
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.anchos.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Largo (m)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.largo}
                      onChange={(e) =>
                        updateItem(it.id, { largo: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Cantidad (und)
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.cantidad}
                      onChange={(e) =>
                        updateItem(it.id, { cantidad: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Precio unitario
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.precioUnitario}
                      onChange={(e) =>
                        updateItem(it.id, { precioUnitario: e.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium mb-1">
                      Acabados (selección múltiple)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {cats.acabados.map((a) => {
                        const selected = it.acabados.includes(a);
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => toggleAcabado(it.id, a)}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mensajes y botón guardar */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar pedido"}
          </button>

          {msg && <p className="text-xs text-emerald-600">{msg}</p>}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      </form>
    </main>
  );
}

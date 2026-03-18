"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type CatalogosSoplado = {
  clientes: string[];
  siigo: string[];
  referencias: string[];
  materialColor: string[];
  bocas: string[];
  acabados: string[];
  vendedores: string[];
};

type ItemSopladoForm = {
  id: string;
  siigo: string;
  referencia: string;
  materialColor: string;
  boca: string;
  volumen: string;
  cantidad: string;
  precioUnitario: string;
  acabados: string[];
};

const emptyCats: CatalogosSoplado = {
  clientes: [],
  siigo: [],
  referencias: [],
  materialColor: [],
  bocas: [],
  acabados: [],
  vendedores: [],
};

const uid = () => "s_" + Math.random().toString(36).slice(2, 9);

function sanitizeDecimalInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");

  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "");
  }

  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  return s;
}

function parseDecimalAnyLocale(v: string): number {
  let s = String(v ?? "").trim();
  if (!s) return NaN;

  s = s.replace(/\s|\u00A0/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else if (hasComma) {
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function toSheetsCommaDecimal(v: string): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.includes(",")) return s;
  return s.replace(/\./g, ",");
}

export default function NuevoPedidoSopladoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const createdBy = String(session?.user?.email ?? "").trim();

  const [cats, setCats] = useState<CatalogosSoplado>(emptyCats);
  const [loadingCats, setLoadingCats] = useState(true);

  const [cliente, setCliente] = useState("");
  const [oc, setOc] = useState("");
  const [fechaReq, setFechaReq] = useState("");
  const [asesor, setAsesor] = useState("");
  const [obs, setObs] = useState("");

  const [items, setItems] = useState<ItemSopladoForm[]>([
    {
      id: uid(),
      siigo: "",
      referencia: "",
      materialColor: "",
      boca: "",
      volumen: "",
      cantidad: "",
      precioUnitario: "",
      acabados: [],
    },
  ]);

  const [ocFile, setOcFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCats(true);
        setErr("");

        const res = await fetch("/api/comercial/catalogos/soplado", {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Error cargando catálogos de soplado");
        }

        setCats(json.data);
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

  const updateItem = (id: string, patch: Partial<ItemSopladoForm>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
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
        siigo: "",
        referencia: "",
        materialColor: "",
        boca: "",
        volumen: "",
        cantidad: "",
        precioUnitario: "",
        acabados: [],
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((it) => it.id !== id)
    );
  };

  const duplicateItem = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;

      const original = prev[idx];
      const duplicated: ItemSopladoForm = {
        ...original,
        id: uid(),
      };

      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicated);
      return copy;
    });
  };

  const validarCabecera = () => {
    if (!createdBy) {
      return "No se pudo identificar el usuario logueado. Cierra sesión y entra de nuevo.";
    }
    if (!cliente.trim()) return 'El campo "Cliente" es obligatorio.';
    if (!asesor.trim()) return 'El campo "Asesor comercial" es obligatorio.';
    if (!oc.trim())
      return 'El campo "N° Orden de Compra / Cotización" es obligatorio.';
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

      if (!it.siigo.trim()) {
        return `Código / Nombre Siigo obligatorio en producto ${n}`;
      }
      if (!it.referencia.trim()) {
        return `Referencia obligatoria en producto ${n}`;
      }
      if (!it.materialColor.trim()) {
        return `Material - Color obligatorio en producto ${n}`;
      }
      if (!it.boca.trim()) {
        return `Boca obligatoria en producto ${n}`;
      }
      if (!it.volumen.trim()) {
        return `Volumen (ml) obligatorio en producto ${n}`;
      }

      const volumenNum = Number(it.volumen);
      if (!(volumenNum > 0)) {
        return `Volumen (ml) debe ser mayor a 0 en producto ${n}`;
      }

      const qty = Number(it.cantidad);
      if (!(qty > 0)) {
        return `Cantidad (und) debe ser > 0 en producto ${n}`;
      }
      if (!Number.isInteger(qty)) {
        return `Cantidad (und) debe ser un número entero en producto ${n}`;
      }

      const precioNum = parseDecimalAnyLocale(it.precioUnitario);
      if (!(precioNum > 0)) {
        return `Precio unitario debe ser mayor a 0 en producto ${n}`;
      }
    }

    return "";
  };

  async function uploadPdfAndGetPath(
    cliente: string,
    oc: string,
    file: File
  ): Promise<string> {
    const formData = new FormData();
    formData.append("cliente", cliente);
    formData.append("oc", oc);
    formData.append("file", file);

    const res = await fetch("/api/comercial/pedidos/upload-url", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Error subiendo PDF");
    }

    const text = await res.text();
    if (!text) throw new Error("Respuesta vacía del servidor al subir PDF");

    const json = JSON.parse(text);

    if (!json.success || !json.pdfPath) {
      throw new Error(json.message || "Respuesta inválida del servidor");
    }

    return json.pdfPath;
  }

  const resetForm = () => {
    setCliente("");
    setOc("");
    setFechaReq("");
    setAsesor("");
    setObs("");

    setItems([
      {
        id: uid(),
        siigo: "",
        referencia: "",
        materialColor: "",
        boca: "",
        volumen: "",
        cantidad: "",
        precioUnitario: "",
        acabados: [],
      },
    ]);

    setOcFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    const errCab = validarCabecera();
    if (errCab) return setErr(errCab);

    const errItems = validarItems();
    if (errItems) return setErr(errItems);

    if (!ocFile) return setErr("Debes adjuntar el PDF de la OC/cotización.");

    try {
      setSaving(true);

      setMsg("Subiendo PDF…");
      const pdfPath = await uploadPdfAndGetPath(cliente.trim(), oc.trim(), ocFile);

      setMsg("Guardando pedido soplado…");

      const payload = {
        cabecera: {
          tipo: "soplado",
          cliente: cliente.trim(),
          oc: oc.trim(),
          fechaRequerida: fechaReq,
          asesor: asesor.trim(),
          obs: obs.trim(),
          fechaSolicitud: new Date().toISOString(),
          created_by: createdBy,
        },
        items: items.map((it) => ({
          siigo: it.siigo.trim(),
          referencia: it.referencia.trim(),
          materialColor: it.materialColor.trim(),
          boca: it.boca.trim(),
          volumen: it.volumen.trim(),
          cantidad: it.cantidad.trim(),
          precioUnitario: toSheetsCommaDecimal(it.precioUnitario.trim()),
          acabados: it.acabados,
        })),
        pdfPath,
      };

      const res = await fetch("/api/comercial/pedidos/guardar-soplado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Error al guardar pedido soplado.");
      }

      setMsg("✅ Pedido soplado guardado correctamente.");
      resetForm();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error al preparar pedido soplado.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/comercial")}
      >
        ← Volver
      </button>

      <div className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        Línea Soplado
      </div>

      <h1 className="mb-1 text-2xl font-semibold">Nuevo pedido soplado</h1>
      <p className="mb-6 text-sm text-slate-500">
        Diligencia la información base del pedido.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Cliente</label>
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

            <div>
              <label className="mb-1 block text-sm font-medium">
                N° Orden de Compra / Cotización
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={oc}
                onChange={(e) => setOc(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
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
              <label className="mb-1 block text-sm font-medium">
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

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                PDF OC/Cotización (obligatorio)
              </label>

              <input
                ref={fileInputRef}
                id="ocFileSoplado"
                type="file"
                accept="application/pdf"
                onChange={(e) => setOcFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="ocFileSoplado"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Seleccionar archivo
                </label>

                <span className="text-sm text-slate-600">
                  {ocFile ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        PDF
                      </span>
                      <span className="max-w-[420px] truncate">{ocFile.name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Ningún archivo seleccionado
                    </span>
                  )}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Sube solo 1 PDF obligatorio.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Observaciones
              </label>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Producto #{index + 1}</span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-emerald-600 hover:text-emerald-700"
                      onClick={() => duplicateItem(it.id)}
                      title="Duplicar producto"
                    >
                      Duplicar
                    </button>

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
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium">
                      Código / Nombre Siigo
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.siigo}
                      onChange={(e) => updateItem(it.id, { siigo: e.target.value })}
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.siigo.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
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
                    <label className="mb-1 block text-xs font-medium">
                      Material - Color
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.materialColor}
                      onChange={(e) =>
                        updateItem(it.id, { materialColor: e.target.value })
                      }
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.materialColor.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Boca
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.boca}
                      onChange={(e) => updateItem(it.id, { boca: e.target.value })}
                      disabled={loadingCats}
                    >
                      <option value="">Seleccione</option>
                      {cats.bocas.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Volumen (ml)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.volumen}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d*$/.test(value)) updateItem(it.id, { volumen: value });
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Cantidad (und)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      value={it.cantidad}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d*$/.test(value)) updateItem(it.id, { cantidad: value });
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Precio unitario
                    </label>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        $ COP
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej: 5500,50"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 pl-14 text-xs"
                        value={it.precioUnitario}
                        onChange={(e) =>
                          updateItem(it.id, {
                            precioUnitario: sanitizeDecimalInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <p className="mt-1 text-[11px] text-slate-500">
                      Usa coma para decimales (ej: 9258,50)
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium">
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

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar pedido soplado"}
          </button>

          {msg && <p className="text-xs text-emerald-600">{msg}</p>}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      </form>
    </main>
  );
}
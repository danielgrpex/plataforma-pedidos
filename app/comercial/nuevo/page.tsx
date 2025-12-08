"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NuevoPedidoPage() {
  const router = useRouter();

  const [cliente, setCliente] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    // TODO: aquí luego llamaremos a la API que escribe en Google Sheets
    // Por ahora solo simulamos y volvemos al listado.
    setTimeout(() => {
      setEnviando(false);
      router.push("/comercial");
    }, 800);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        ← Volver
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">
        Nuevo pedido comercial
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Diligencia la información base del pedido. En el siguiente paso
        conectaremos esto con Google Sheets.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Cliente
          </label>
          <input
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
            placeholder="Nombre del cliente"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Descripción del pedido
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
            placeholder="Resumen del pedido o referencia interna"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Condiciones comerciales
          </label>
          <textarea
            value={condiciones}
            onChange={(e) => setCondiciones(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
            placeholder="Forma de pago, plazos, acuerdos especiales, etc."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/comercial")}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {enviando ? "Guardando..." : "Guardar pedido"}
          </button>
        </div>
      </form>
    </main>
  );
}

// app/produccion/page.tsx
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";

export default async function ProduccionPage() {
  const session = await getAuthSession();
  // @ts-ignore
  const role = session?.user?.role;

  if (!session || (role !== "produccion" && role !== "admin")) {
    redirect("/sin-acceso");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Módulo Producción
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Aquí va el panel de órdenes en proceso, cortes, tiempos, etc.
      </p>
    </div>
  );
}

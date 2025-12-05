// app/sin-acceso/page.tsx
import Link from "next/link";

export default function SinAccesoPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          No tienes acceso a este módulo
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Si crees que esto es un error, contacta al administrador del sistema
          para revisar tus permisos.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

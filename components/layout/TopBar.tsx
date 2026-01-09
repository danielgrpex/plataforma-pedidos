"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

type AppRole = "admin" | "comercial" | "produccion" | "planeacion" | "logistica";

export function TopBar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  const role = (session?.user as any)?.role as AppRole | undefined;

  // Para visitantes: se ve todo pero al click manda a login
  const guestHref = "/api/auth/signin";

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Línea sutil de color arriba */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-sky-400 to-violet-500" />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Marca */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-sm">
            GR
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Plataforma Pedidos
            </span>
            <span className="text-sm font-semibold text-slate-900">Panel Operativo</span>
          </div>
        </div>

        {/* Navegación por rol */}
        <nav className="flex items-center gap-4 text-sm">
          {/* Comercial */}
          {(!isAuthed || role === "comercial" || role === "planeacion" || role === "logistica" || role === "admin") && (
            <Link
              href={isAuthed ? "/comercial" : guestHref}
              className="text-slate-700 hover:text-emerald-600"
            >
              Comercial
            </Link>
          )}

          {/* Planeación */}
          {(!isAuthed || role === "planeacion" || role === "admin") && (
            <Link
              href={isAuthed ? "/planeacion" : guestHref}
              className="text-slate-700 hover:text-emerald-600"
            >
              Planeación
            </Link>
          )}

          {/* Producción */}
          {(!isAuthed || role === "produccion" || role === "admin") && (
            <Link
              href={isAuthed ? "/produccion" : guestHref}
              className="text-slate-700 hover:text-emerald-600"
            >
              Producción
            </Link>
          )}

          {/* Logística */}
          {(!isAuthed || role === "logistica" || role === "admin") && (
            <Link
              href={isAuthed ? "/abastecimientologistica" : guestHref}
              className="text-slate-700 hover:text-emerald-600"
            >
              Abastecimiento y Logística
            </Link>
          )}

          {/* Auth */}
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:inline">
                {session?.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("auth0")}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              Entrar al sistema
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

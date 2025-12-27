//components/layout/MainHeader.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

type AppRole = "admin" | "comercial" | "produccion" | "planeacion" | "logistica";

export function MainHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const role = (session?.user as any)?.role as AppRole | undefined;
  const isAuthed = status === "authenticated";

  // 🔐 permisos reales (solo aplican si está logueado)
  const can = {
    comercial: role === "comercial" || role === "planeacion" || role === "admin",
    planeacion: role === "planeacion" || role === "admin",
    produccion: role === "produccion" || role === "admin",
    logistica: role === "logistica" || role === "admin",
  };

  // 👉 destino cuando NO está logueado
  const guestHref = "/api/auth/signin";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
      {/* Línea superior */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-sky-400 to-violet-500" />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Marca */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-sm">
            GR
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Industrias Plásticas GR
            </span>
            <span className="text-sm font-semibold text-slate-900">
              Sistema de información PEX
            </span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="hidden items-center gap-2 text-sm md:flex">
          <NavItem href="/" active={isActive("/")}>
            Inicio
          </NavItem>

          {/* Comercial */}
          {(!isAuthed || can.comercial) && (
            <NavItem
              href={isAuthed ? "/comercial" : guestHref}
              active={isActive("/comercial")}
            >
              Comercial
            </NavItem>
          )}

          {/* Planeación */}
          {(!isAuthed || can.planeacion) && (
            <NavItem
              href={isAuthed ? "/planeacion" : guestHref}
              active={isActive("/planeacion")}
            >
              Planeación
            </NavItem>
          )}

          {/* Producción */}
          {(!isAuthed || can.produccion) && (
            <NavItem
              href={isAuthed ? "/produccion" : guestHref}
              active={isActive("/produccion")}
            >
              Producción
            </NavItem>
          )}

          {/* Logística */}
          {(!isAuthed || can.logistica) && (
            <NavItem
              href={isAuthed ? "/abastecimientologistica" : guestHref}
              active={isActive("/abastecimientologistica")}
            >
              Abastecimiento y Logística
            </NavItem>
          )}
        </nav>

        {/* Zona derecha */}
        <div className="flex items-center gap-3">
          {isAuthed ? (
            <>
              <span className="hidden max-w-[180px] truncate text-xs text-slate-500 sm:inline">
                {session?.user?.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => signIn("auth0")}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              Entrar al sistema
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* =========================
   NavItem
   ========================= */

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
          : "rounded-full px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
      }
    >
      {children}
    </Link>
  );
}

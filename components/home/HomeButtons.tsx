"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";

export function HomeButtons() {
  const { data: session } = useSession();
  const isLogged = !!session;

  return (
    <div className="flex flex-wrap gap-3">
      {/* SOLO mostrar si NO está logueado */}
      {!isLogged && (
        <button
          onClick={() => signIn("auth0")}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Entrar al sistema
        </button>
      )}

      {/* Siempre visible */}
      <a
        href="#modulos"
        className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
      >
        Ver módulos
      </a>
    </div>
  );
}

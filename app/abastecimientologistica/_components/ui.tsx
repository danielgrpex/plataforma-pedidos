//app/abastecimientologistica/_components/ui.tsx
import React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function HeaderBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tracking-tight text-neutral-900">{title}</div>
      <div className="mt-1 text-sm text-neutral-600">{subtitle}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-neutral-600">{label}</div>
      {children}
    </label>
  );
}

export function safeNumber(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

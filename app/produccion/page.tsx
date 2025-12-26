// app/produccion/page.tsx
// app/produccion/page.tsx
import Link from "next/link";
import {
  Scissors,
  Package,
  Factory,
  CalendarClock,
  Activity,
  AlertTriangle,
  ArrowRight,
  Search,
  FileText,
  CheckCircle2,
  User,
  Clock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type KPI = {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone?: "default" | "warning";
};

function IconBubble({
  icon: Icon,
  tone = "default",
}: {
  icon: React.ElementType;
  tone?: "default" | "warning";
}) {
  const base =
    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/70 shadow-sm backdrop-blur";
  const ring = tone === "warning" ? " border-amber-200/60" : " border-slate-200/70";
  return (
    <div className={base + ring}>
      <Icon className="h-5 w-5 text-slate-700" />
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const Icon = kpi.icon;
  return (
    <Card className="border-slate-200/70 bg-white/70 shadow-sm backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <IconBubble icon={Icon} tone={kpi.tone === "warning" ? "warning" : "default"} />
        {kpi.tone === "warning" ? (
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Atención</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-900 hover:bg-slate-100">Hoy</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight text-slate-900">{kpi.value}</div>
        <div className="mt-1 text-sm font-medium text-slate-900">{kpi.title}</div>
        <div className="mt-1 text-xs text-slate-500">{kpi.sub}</div>
      </CardContent>
    </Card>
  );
}

function ProcessCard({
  title,
  description,
  href,
  icon: Icon,
  badge,
  primary,
  metrics,
  footerLink,
  footerLinkHref,
  soon,
}: {
  title: string;
  description: string;
  href?: string;
  icon: React.ElementType;
  badge: { text: string; variant: "active" | "ready" | "soon" };
  primary?: boolean;
  metrics?: { label: string; value: string }[];
  footerLink?: string;
  footerLinkHref?: string;
  soon?: boolean;
}) {
  const badgeClass =
    badge.variant === "active"
      ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"
      : badge.variant === "ready"
      ? "bg-sky-100 text-sky-900 hover:bg-sky-100"
      : "bg-slate-100 text-slate-700 hover:bg-slate-100";

  const shell =
    "relative overflow-hidden border-slate-200/70 bg-white/70 shadow-sm backdrop-blur transition-all duration-200";
  const hover = soon ? "" : " hover:-translate-y-0.5 hover:shadow-md";
  const heroGlow = primary
    ? " before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-sky-500/10 before:via-transparent before:to-emerald-500/10 before:opacity-100"
    : "";

  const leftAccent = primary
    ? " after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-full after:w-1 after:bg-gradient-to-b after:from-sky-500 after:to-emerald-500"
    : "";

  const content = (
    <Card className={`${shell}${hover}${heroGlow}${leftAccent}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <Icon className="h-5 w-5 text-slate-800" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900">{title}</CardTitle>
              <CardDescription className="mt-1 text-sm">{description}</CardDescription>
            </div>
          </div>
          <Badge className={badgeClass}>{badge.text}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {metrics?.length ? (
          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <span className="font-medium text-slate-900">{m.value}</span>
                <span className="text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {soon ? (
            <Button variant="secondary" disabled className="rounded-xl">
              Próximamente
            </Button>
          ) : (
            <Button asChild className="rounded-xl">
              <Link href={href || "#"} className="inline-flex items-center gap-2">
                Entrar <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}

          {footerLink && footerLinkHref && !soon ? (
            <Button asChild variant="ghost" className="rounded-xl">
              <Link href={footerLinkHref} className="text-slate-700">
                {footerLink}
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tip: entra aquí para operar y registrar actividades del proceso.
        </div>
      </CardContent>
    </Card>
  );

  return content;
}

function ActivityItem({
  icon: Icon,
  title,
  meta,
  when,
}: {
  icon: React.ElementType;
  title: string;
  meta?: string;
  when: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <Icon className="h-4 w-4 text-slate-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{title}</div>
        {meta ? <div className="truncate text-xs text-slate-500">{meta}</div> : null}
      </div>
      <div className="shrink-0 text-xs text-slate-500">{when}</div>
    </div>
  );
}

export default function ProduccionPage() {
  const kpis: KPI[] = [
    { title: "Pendientes (Corte)", value: "—", sub: "Planeación dejó en estado Corte", icon: Scissors },
    { title: "En proceso", value: "—", sub: "Operaciones activas", icon: Activity },
    { title: "Por empacar", value: "—", sub: "Listos para empaque", icon: Package },
    { title: "Alertas", value: "—", sub: "Revisar novedades", icon: AlertTriangle, tone: "warning" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_60%_at_20%_0%,rgba(56,189,248,0.16)_0%,rgba(255,255,255,0)_55%),radial-gradient(60%_60%_at_80%_10%,rgba(34,197,94,0.12)_0%,rgba(255,255,255,0)_55%)]">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Módulo Producción</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Panel de producción: procesos, órdenes, registro de actividades y entregas en tiempo real.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">🟢 Operación normal</Badge>
              <Badge className="bg-slate-100 text-slate-900 hover:bg-slate-100">🕒 Turno: —</Badge>
            </div>

            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 rounded-xl border-slate-200/70 bg-white/70 pl-9 backdrop-blur"
                placeholder="Buscar OC / Pedido…"
              />
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.title} kpi={k} />
          ))}
        </div>

        {/* Main grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left: Processes */}
          <div className="space-y-6">
            <ProcessCard
              title="Corte"
              description="Genera órdenes de corte, define actividades y controla salida a planta."
              href="/produccion/corte"
              icon={Scissors}
              badge={{ text: "Activo", variant: "active" }}
              primary
              metrics={[
                { label: "Pendientes", value: "—" },
                { label: "Generadas hoy", value: "—" },
                { label: "Última OC", value: "—" },
              ]}
              footerLink="Ver historial de órdenes"
              footerLinkHref="/produccion/corte"
            />

            <div className="grid gap-6 md:grid-cols-2">
              <ProcessCard
                title="Empaque"
                description="Control Operativo: iniciar actividad, finalizar y entregar a almacén."
                href="/produccion/empaque"
                icon={Package}
                badge={{ text: "UI lista", variant: "ready" }}
                metrics={[
                  { label: "Por entregar", value: "—" },
                  { label: "En QA", value: "—" },
                ]}
              />

              <ProcessCard
                title="Extrusión"
                description="Registro y control operativo del proceso de extrusión."
                icon={Factory}
                badge={{ text: "Próximamente", variant: "soon" }}
                soon
              />

              <ProcessCard
                title="Programación"
                description="Planificación de cargas, secuencias y prioridades de producción."
                icon={CalendarClock}
                badge={{ text: "Próximamente", variant: "soon" }}
                soon
              />
            </div>

            <Card className="border-slate-200/70 bg-white/70 shadow-sm backdrop-blur">
              <CardContent className="py-4 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Tip:</span> Planeación deja los ítems en estado{" "}
                <span className="font-medium text-slate-900">Corte</span>. Producción los toma desde{" "}
                <span className="font-medium text-slate-900">/produccion/corte</span> y genera la Orden de Corte.
                Empaque será el punto donde operarios registran actividad y entregan a almacén.
              </CardContent>
            </Card>
          </div>

          {/* Right: Activity + Quick actions */}
          <div className="space-y-6">
            <Card className="border-slate-200/70 bg-white/70 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900">Actividad reciente</CardTitle>
                <CardDescription>Últimos eventos del módulo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ActivityItem icon={FileText} title="PDF generado" meta="Orden de corte • —" when="—" />
                <ActivityItem icon={CheckCircle2} title="Estado actualizado" meta="2 ítems → Corte Generado" when="—" />
                <ActivityItem icon={User} title="Generó" meta="—" when="—" />
                <ActivityItem icon={Clock} title="Última ejecución" meta="Sincronización / export" when="—" />

                <Separator className="bg-slate-200/70" />

                <Button variant="secondary" className="w-full rounded-xl">
                  Ver todo el historial
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/70 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900">Accesos rápidos</CardTitle>
                <CardDescription>Acciones comunes</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="h-11 justify-between rounded-xl border-slate-200/70 bg-white">
                  <Link href="/produccion/corte" className="flex w-full items-center justify-between">
                    Pendientes de Corte <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button variant="outline" className="h-11 justify-between rounded-xl border-slate-200/70 bg-white">
                  Buscar OC <ArrowRight className="h-4 w-4" />
                </Button>

                <Button variant="outline" className="h-11 justify-between rounded-xl border-slate-200/70 bg-white">
                  Órdenes del día <ArrowRight className="h-4 w-4" />
                </Button>

                <Button variant="outline" className="h-11 justify-between rounded-xl border-slate-200/70 bg-white">
                  Storage: ordenes-corte <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

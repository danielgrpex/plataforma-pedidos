export function Footer() {
  return (
    <footer className="mt-0 border-t border-slate-200 bg-white/50 backdrop-blur py-8">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
        
        <span className="font-medium text-slate-600">
          Soporte técnico · daniel.alfonso@inplastgr.com
        </span>

        <span>
          © {new Date().getFullYear()} Industrias Plásticas GR — Todos los derechos reservados.
        </span>

        <span className="text-[11px] text-slate-400">
          Powered by <span className="font-semibold">Daniel Alfonso</span>
        </span>
      </div>
    </footer>
  );
}

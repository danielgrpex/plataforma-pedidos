// app/403/page.tsx

export default function Page403() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">🚫 Acceso denegado</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tu usuario no tiene permisos para entrar a este módulo.
        </p>
      </div>
    </div>
  );
}

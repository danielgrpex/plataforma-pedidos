import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";

export default async function ComercialLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthSession();

  if (!session?.user) {
    // No autenticado → enviar a login
    redirect("/api/auth/signin");
  }

  // @ts-ignore (role viene extendido en next-auth.d.ts)
  const role = session.user.role as string | undefined;

  // Solo pueden entrar comercial y admin
if (role !== "comercial" && role !== "planeacion" && role !== "logistica"&& role !== "admin") {
  redirect("/403");
}

  return <>{children}</>;
}

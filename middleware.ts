import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  // Si no está logueado -> al login
  if (!token?.email) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }

  const role = (token as any).role as string | null;
  const pathname = req.nextUrl.pathname;

  // primer segmento: /comercial/..., /planeacion/...
  const module = pathname.split("/")[1];

  if (MODULE_PERMISSIONS[module]) {
    const allowed = MODULE_PERMISSIONS[module].includes(role as any);
    if (!allowed) {
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/comercial/:path*",
    "/planeacion/:path*",
    "/produccion/:path*",
    "/abastecimientologistica/:path*", // AJUSTA al nombre real de tu ruta
  ],
};

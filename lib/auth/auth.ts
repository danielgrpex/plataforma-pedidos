// lib/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";
import { env } from "@/lib/config/env"; // 👈 NUEVO IMPORT

type UserRole = "comercial" | "produccion" | "admin" | null;

const getRoleFromEmail = (email: string): UserRole => {
  const map: Record<string, Exclude<UserRole, null>> = {
    "daniel.alfonso@inplastgr.com": "admin",
    // aquí puedes agregar otros correos con rol fijo si quieres
    // "otro@implastgr.com": "produccion",
  };

  const normalized = email.toLowerCase();

  if (map[normalized]) return map[normalized];

  if (normalized.endsWith("@inplastgr.com")) return "comercial";

  return null;
};

// 👉 Lista de correos extra permitidos, fuera del dominio de la empresa
const extraAllowedEmails = [
  "dalfonsoleon1@GMAIL.COM", // <- cambia esto por tu correo real
  // puedes agregar más:
  // "otro.correo@gmail.com",
];

export const authOptions: NextAuthOptions = {
  providers: [
    Auth0Provider({
      clientId: env.AUTH0_CLIENT_ID,
      clientSecret: env.AUTH0_CLIENT_SECRET,
      issuer: env.AUTH0_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const email = user.email.toLowerCase();

      const isCompany = email.endsWith("@inplastgr.com");
      const isExtraAllowed = extraAllowedEmails.map(e => e.toLowerCase()).includes(email);

      // Solo dejamos entrar si es correo de la empresa o está en la lista blanca
      if (!isCompany && !isExtraAllowed) {
        return false;
      }

      return true;
    },

    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const email = (profile.email as string).toLowerCase();
        token.email = email;
        token.role = getRoleFromEmail(email);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        // @ts-ignore (role está extendido en next-auth.d.ts)
        session.user.role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

// Para usar en el server (layouts, páginas protegidas, etc.)
export const getAuthSession = () => getServerSession(authOptions);

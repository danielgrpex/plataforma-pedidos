// lib/auth/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";
import GoogleProvider from "next-auth/providers/google";

type UserRole = "comercial" | "produccion" | "admin" | null;

const getRoleFromEmail = (email: string): UserRole => {
  const map: Record<string, Exclude<UserRole, null>> = {
    "daniel.alfonso@inplastgr.com": "admin",
  };

  const normalized = email.toLowerCase();
  if (map[normalized]) return map[normalized];
  if (normalized.endsWith("@inplastgr.com")) return "comercial";
  return null;
};

const extraAllowedEmails = ["dalfonsoleon1@gmail.com"].map((e) => e.toLowerCase());

// ✅ Para NO depender de tu env.ts mientras depuramos providers:
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const AUTH0_ISSUER = process.env.AUTH0_ISSUER;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Esto te evita el “no aparece Google en /providers” por variables vacías
function assertEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`[auth] Missing env var: ${name}`);
  return value;
}

export const authOptions: NextAuthOptions = {
  debug: true,

  providers: [
    Auth0Provider({
      clientId: assertEnv("AUTH0_CLIENT_ID", AUTH0_CLIENT_ID),
      clientSecret: assertEnv("AUTH0_CLIENT_SECRET", AUTH0_CLIENT_SECRET),
      issuer: assertEnv("AUTH0_ISSUER", AUTH0_ISSUER),
    }),

    GoogleProvider({
      clientId: assertEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID),
      clientSecret: assertEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET),
      authorization: {
        params: {
          // ✅ importante: incluir Drive scope para poder crear carpetas/subir PDF con OAuth
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.file",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const email = user.email.toLowerCase();
      const isCompany = email.endsWith("@inplastgr.com");
      const isExtraAllowed = extraAllowedEmails.includes(email);

      return isCompany || isExtraAllowed;
    },

    async jwt({ token, account, profile }) {
      // email + role (para tu app)
      const email =
        (profile as any)?.email?.toLowerCase?.() ??
        (token.email as string | undefined);

      if (email) {
        token.email = email;
        (token as any).role = getRoleFromEmail(email);
      }

      // ✅ SOLO cuando viene de Google guardamos access_token
      if (account?.provider === "google" && account.access_token) {
        (token as any).googleAccessToken = account.access_token;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        // @ts-ignore
        session.user.role = (token as any).role;

        // @ts-ignore
        session.googleAccessToken = (token as any).googleAccessToken;
      }
      return session;
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions);

// lib/config/env.ts

export const env = {
  GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL!,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
  SHEET_INFO_ID: process.env.SHEET_INFO_ID!,
  SHEET_BASE_PRINCIPAL_ID: process.env.SHEET_BASE_PRINCIPAL_ID!,
  GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_PDF_BUCKET: process.env.SUPABASE_PDF_BUCKET || "pedidos-pdf",


  // 👇 añadimos estas 3:
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID!,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET!,
  AUTH0_ISSUER: process.env.AUTH0_ISSUER!,

    // NextAuth
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
};

Object.entries(env).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`❌ Missing environment variable: ${key}`);
  }
});

export type Role = "comercial" | "planeacion" | "produccion" | "logistica" | "admin";

export const USER_ROLES: Record<string, Role> = {
  "asistextrusionysoplado@inplastgr.com": "comercial",
  "dalfonsoleon1@gmail.com": "planeacion",
  "paolasuarezorjuela@gmail.com": "produccion",
  "soplado@inplastgr.com": "comercial",
};

// Opcional: si quieres que TU correo sea admin total, cambia a:
/// "dalfonsoleon1@gmail.com": "ADMIN",

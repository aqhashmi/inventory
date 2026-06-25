import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment NextAuth types so `session.user` and the JWT carry our tenant fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    role: UserRole;
  }
}

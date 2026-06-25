import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** Returns the current session or null. */
export async function getSession() {
  return auth();
}

/** Returns the session, redirecting to /login when unauthenticated. */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Convenience for server components / actions: returns the authenticated user's
 * tenant context. Every tenant-scoped query MUST filter by `organizationId`.
 */
export async function requireOrg() {
  const session = await requireAuth();
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

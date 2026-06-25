import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Edge middleware runs the `authorized` callback for route protection.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};

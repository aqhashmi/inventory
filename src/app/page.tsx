import { redirect } from "next/navigation";

// Middleware redirects "/" based on auth state; this is a server-side fallback.
export default function Home() {
  redirect("/dashboard");
}

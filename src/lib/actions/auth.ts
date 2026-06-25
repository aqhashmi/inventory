"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

export async function registerUser(
  values: unknown,
): Promise<ActionResult<{ email: string }>> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const { name, organizationName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return {
      success: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: ["Email already in use"] },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // An organization and its first (OWNER) user are created together.
  await prisma.organization.create({
    data: {
      name: organizationName,
      users: {
        create: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: "OWNER",
        },
      },
    },
  });

  return { success: true, data: { email: normalizedEmail } };
}

export async function authenticate(
  values: unknown,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Invalid email or password." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

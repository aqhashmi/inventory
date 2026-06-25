import type { z } from "zod";

/** Standard discriminated result returned by every server action. */
export type ActionResult<T = void> =
  | { success: true; data?: T; message?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

/** Flatten a ZodError into the shape consumed by forms. */
export function zodFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

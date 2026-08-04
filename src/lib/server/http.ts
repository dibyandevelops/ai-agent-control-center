import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from "./action-service";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  const message =
    error instanceof Error ? error.message : "Unexpected server error.";
  console.error("SentinelOps API error", error);
  const configurationError = message.includes("DATABASE_URL");
  return NextResponse.json(
    {
      error: configurationError
        ? message
        : "The request could not be completed.",
    },
    { status: configurationError ? 503 : 500 },
  );
}

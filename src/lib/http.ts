import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";

export function jsonError(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return NextResponse.json({ error: message, code }, { status, headers });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...error.details },
      { status: error.status },
    );
  }

  console.error(error);
  return jsonError(500, "INTERNAL", "Something went wrong");
}

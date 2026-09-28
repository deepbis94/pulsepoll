import { NextResponse } from "next/server";

import { jsonError, toErrorResponse } from "@/lib/http";
import { enforceVoteLimit } from "@/lib/rate-limit";
import { isShortCode } from "@/lib/short-code";
import { castVoteSchema, formatZodError } from "@/lib/validators";
import { newVisitorId, readVisitorId, visitorCookieOptions } from "@/lib/voter";
import { castVote } from "@/lib/votes";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!isShortCode(code)) {
    return jsonError(404, "NOT_FOUND", "Poll not found");
  }

  const limited = await enforceVoteLimit(request, code);
  if (limited) return limited;

  try {
    const body: unknown = await request.json();
    const parsed = castVoteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "INVALID_INPUT", formatZodError(parsed.error));
    }

    const existingVisitor = readVisitorId(request);
    const visitorId = existingVisitor ?? newVisitorId();
    const results = await castVote(code, visitorId, parsed.data);
    const response = NextResponse.json(results, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });

    if (!existingVisitor) {
      response.cookies.set(visitorCookieOptions(visitorId));
    }

    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(400, "INVALID_JSON", "Request body must be JSON");
    }
    return toErrorResponse(error);
  }
}

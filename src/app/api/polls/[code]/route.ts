import { NextResponse } from "next/server";

import { jsonError, toErrorResponse } from "@/lib/http";
import { readPollResults } from "@/lib/read-poll";
import { isShortCode } from "@/lib/short-code";
import { newVisitorId, readVisitorId, visitorCookieOptions } from "@/lib/voter";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    if (!isShortCode(code)) {
      return jsonError(404, "NOT_FOUND", "Poll not found");
    }

    const existingVisitor = readVisitorId(request);
    const visitorId = existingVisitor ?? newVisitorId();
    const results = await readPollResults(code, visitorId);
    const response = NextResponse.json(results, {
      headers: { "Cache-Control": "no-store" },
    });

    if (!existingVisitor) {
      response.cookies.set(visitorCookieOptions(visitorId));
    }

    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

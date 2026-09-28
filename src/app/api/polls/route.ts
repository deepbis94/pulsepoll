import { NextResponse } from "next/server";

import { jsonError, toErrorResponse } from "@/lib/http";
import { createPoll } from "@/lib/polls";
import { enforceCreateLimit } from "@/lib/rate-limit";
import { createPollSchema, formatZodError } from "@/lib/validators";

export async function POST(request: Request) {
  const limited = await enforceCreateLimit(request);
  if (limited) return limited;

  try {
    const body: unknown = await request.json();
    const parsed = createPollSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "INVALID_INPUT", formatZodError(parsed.error));
    }

    const poll = await createPoll(parsed.data);
    return NextResponse.json(
      { shortCode: poll.shortCode, path: `/p/${poll.shortCode}` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(400, "INVALID_JSON", "Request body must be JSON");
    }
    return toErrorResponse(error);
  }
}

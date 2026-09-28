import { sha256Hex } from "@/lib/hash";

export const VISITOR_COOKIE = "pp_vid";

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const YEAR_SECONDS = 60 * 60 * 24 * 400;

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function readVisitorId(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== VISITOR_COOKIE) continue;
    const value = decodeURIComponent(rest.join("=")).trim();
    if (VISITOR_ID.test(value)) return value.toLowerCase();
  }

  return null;
}

export async function voterKeyFor(pollId: string, visitorId: string): Promise<string> {
  return sha256Hex(`${pollId}:${visitorId}`);
}

export function visitorCookieOptions(value: string) {
  return {
    name: VISITOR_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR_SECONDS,
  };
}

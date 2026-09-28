import { AppError } from "@/lib/errors";
import { initPollCache } from "@/lib/poll-cache";
import { getPrisma } from "@/lib/prisma";
import { createShortCode } from "@/lib/short-code";
import type { CreatePollInput } from "@/lib/validators";

export async function createPoll(input: CreatePollInput): Promise<{ shortCode: string }> {
  const expiresAt = input.durationMinutes
    ? new Date(Date.now() + input.durationMinutes * 60_000)
    : null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortCode = createShortCode();
    try {
      const poll = await getPrisma().poll.create({
        data: {
          shortCode,
          question: input.question,
          choiceType: input.choiceType,
          expiresAt,
          options: {
            create: input.options.map((label, position) => ({ label, position })),
          },
        },
        include: { options: { orderBy: { position: "asc" } } },
      });

      try {
        await initPollCache({
          id: poll.id,
          shortCode: poll.shortCode,
          question: poll.question,
          choiceType: poll.choiceType,
          expiresAt: poll.expiresAt?.toISOString() ?? null,
          createdAt: poll.createdAt.toISOString(),
          options: poll.options.map((option) => ({
            id: option.id,
            label: option.label,
            position: option.position,
          })),
        });
      } catch (error) {
        console.error("Failed to warm poll cache", error);
      }

      return { shortCode: poll.shortCode };
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }

  throw new AppError(500, "INTERNAL", "Could not allocate a poll code");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

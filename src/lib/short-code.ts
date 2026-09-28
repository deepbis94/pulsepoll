import { customAlphabet } from "nanoid";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export const SHORT_CODE_LENGTH = 8;

const createCode = customAlphabet(ALPHABET, SHORT_CODE_LENGTH);

const SHORT_CODE = new RegExp(`^[${ALPHABET}]{${SHORT_CODE_LENGTH}}$`);

export function createShortCode(): string {
  return createCode();
}

export function isShortCode(value: string): boolean {
  return SHORT_CODE.test(value);
}

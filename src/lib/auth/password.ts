import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
	return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const [algorithm, salt, digest] = storedHash.split(":");
	if (algorithm !== "scrypt" || !salt || !digest) return false;
	const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
	const expected = Buffer.from(digest, "hex");
	return expected.length === derived.length && timingSafeEqual(expected, derived);
}

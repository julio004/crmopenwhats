import fs from "node:fs";
import path from "node:path";

import type { MessageRow } from "./db-contract.ts";

const mediaStorageDir = process.env.BOT_MEDIA_DIR
	? path.resolve(/*turbopackIgnore: true*/ process.env.BOT_MEDIA_DIR)
	: path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "media");

const publicMediaDir = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "media");

function filenameFromMediaUrl(mediaUrl: unknown): string | null {
	if (typeof mediaUrl !== "string") return null;
	const match = mediaUrl.match(/^\/media\/([a-zA-Z0-9._-]+)$/);
	return match?.[1] ?? null;
}

function mediaFileExists(filename: string): boolean {
	const candidates = [
		path.join(mediaStorageDir, filename),
		path.join(publicMediaDir, filename),
	];

	return candidates.some((candidate) => {
		try {
			return (
				fs.existsSync(/*turbopackIgnore: true*/ candidate) &&
				fs.statSync(/*turbopackIgnore: true*/ candidate).isFile()
			);
		} catch {
			return false;
		}
	});
}

export function withMediaAvailability<T extends MessageRow>(messages: T[]): T[] {
	return messages.map((message) => {
		if (message.media_type !== "audio" && message.media_type !== "image") {
			return message;
		}

		const filename = filenameFromMediaUrl(message.metadata.mediaUrl);
		if (!filename) return message;

		return {
			...message,
			metadata: {
				...message.metadata,
				mediaAvailable: mediaFileExists(filename),
			},
		};
	});
}

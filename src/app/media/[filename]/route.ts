import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

interface Ctx {
	params: Promise<{ filename: string }>;
}

const mediaStorageDir = process.env.BOT_MEDIA_DIR
	? path.resolve(/*turbopackIgnore: true*/ process.env.BOT_MEDIA_DIR)
	: path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "media");

const publicMediaDir = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "media");

const CONTENT_TYPES: Record<string, string> = {
	".ogg": "audio/ogg",
	".opus": "audio/ogg",
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".wav": "audio/wav",
	".webm": "audio/webm",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
};

function isSafeMediaFilename(filename: string): boolean {
	return /^[a-zA-Z0-9._-]+\.(ogg|opus|mp3|m4a|wav|webm|jpg|jpeg|png|webp)$/i.test(filename);
}

function resolveExistingMediaFile(filename: string): string | null {
	const candidates = [
		path.join(mediaStorageDir, filename),
		path.join(publicMediaDir, filename),
	];

	for (const candidate of candidates) {
		const resolved = path.resolve(/*turbopackIgnore: true*/ candidate);
		if (
			fs.existsSync(/*turbopackIgnore: true*/ resolved) &&
			fs.statSync(/*turbopackIgnore: true*/ resolved).isFile()
		) {
			return resolved;
		}
	}

	return null;
}

export async function GET(_req: Request, { params }: Ctx) {
	const { filename } = await params;

	if (!isSafeMediaFilename(filename)) {
		return NextResponse.json({ error: "Invalid media filename" }, { status: 400 });
	}

	const filePath = resolveExistingMediaFile(filename);
	if (!filePath) {
		return NextResponse.json({ error: "Media not found" }, { status: 404 });
	}

	const buffer = await fs.promises.readFile(/*turbopackIgnore: true*/ filePath);
	const ext = path.extname(filename).toLowerCase();

	return new Response(buffer, {
		headers: {
			"content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
			"cache-control": "private, max-age=3600",
		},
	});
}

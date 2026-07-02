import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
	getMessages,
	getConversationById,
	insertMessageAndTouchConversation,
	enqueueOutbox,
	updateConversation,
} from "../../../../lib/db.ts";
import { withMediaAvailability } from "../../../../lib/media-metadata.ts";
import { outboxDestinationForConversation } from "../../../../lib/outbox-routing.ts";
import { runtimePaths } from "../../../../lib/runtime-paths.ts";
import type { MediaType } from "../../../../lib/db-contract.ts";

interface Ctx {
	params: Promise<{ conversationId: string }>;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"]);

function extensionForFile(file: File, mediaType: MediaType) {
	const declared = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
	if (declared && /^[a-z0-9]{2,5}$/.test(declared)) return declared;
	if (file.type === "image/png") return "png";
	if (file.type === "image/webp") return "webp";
	if (file.type === "audio/webm") return "webm";
	if (file.type === "audio/mpeg") return "mp3";
	if (file.type === "audio/mp4") return "m4a";
	if (file.type === "audio/wav") return "wav";
	return mediaType === "audio" ? "ogg" : "jpg";
}

async function persistDashboardMedia(file: File, mediaType: MediaType) {
	await fs.mkdir(runtimePaths.mediaDir, { recursive: true });
	const id = crypto.randomUUID();
	const extension = extensionForFile(file, mediaType);
	const filename = `dashboard-${id}.${extension}`;
	const filePath = path.join(runtimePaths.mediaDir, filename);
	const buffer = Buffer.from(await file.arrayBuffer());
	await fs.writeFile(filePath, buffer);
	return {
		mediaUrl: `/media/${filename}`,
		metadata: {
			mediaUrl: `/media/${filename}`,
			originalName: file.name,
			mimeType: file.type,
			size: file.size,
			uploadedFrom: "dashboard",
		},
	};
}

// Carga el historial de mensajes de la conversación
export async function GET(_req: Request, { params }: Ctx) {
	try {
		const { conversationId } = await params;
		const parsedId = Number.parseInt(conversationId, 10);
		
		if (Number.isNaN(parsedId)) {
			return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
		}

		const messages = withMediaAvailability(await getMessages(parsedId, 100));
		
		// Reset unread_count on read
		await updateConversation(parsedId, { unread_count: 0 }).catch((err) => {
			if (err.message && err.message.includes("conversation_not_found")) {
				// Silently ignore if conversation was deleted
				return;
			}
			console.error("[api] Failed to reset unread_count:", err);
		});
		return NextResponse.json(messages);
	} catch (error: any) {
		console.error("[api] Error en GET /api/messages/[conversationId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

// Envía un mensaje manual (Humano) desde el dashboard encolándolo en el outbox
export async function POST(req: Request, { params }: Ctx) {
	try {
		const { conversationId } = await params;
		const parsedId = Number.parseInt(conversationId, 10);
		
		if (Number.isNaN(parsedId)) {
			return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
		}

		const contentType = req.headers.get("content-type") ?? "";
		let content = "";
		let mediaType: MediaType = "text";
		let mediaUrl: string | null = null;
		let metadata: Record<string, unknown> = {};

		if (contentType.includes("multipart/form-data")) {
			const formData = await req.formData();
			const maybeContent = formData.get("content");
			const file = formData.get("file");
			content = typeof maybeContent === "string" ? maybeContent : "";
			if (file instanceof File && file.size > 0) {
				if (IMAGE_TYPES.has(file.type)) {
					mediaType = "image";
				} else if (AUDIO_TYPES.has(file.type)) {
					mediaType = "audio";
				} else {
					return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
				}
				const saved = await persistDashboardMedia(file, mediaType);
				mediaUrl = saved.mediaUrl;
				metadata = saved.metadata;
				if (!content.trim()) {
					content = mediaType === "audio" ? "Nota de voz" : "Imagen enviada";
				}
			}
		} else {
			const body = await req.json();
			content = typeof body.content === "string" ? body.content : "";
		}

		if (!content || typeof content !== "string" || !content.trim()) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}

		const conversation = await getConversationById(parsedId);
		if (!conversation) {
			return NextResponse.json({ error: "Conversation not found" }, { status: 444 });
		}

		// 1. Persistimos el mensaje localmente como 'human' y 'outbound' para visualización inmediata
		const message = await insertMessageAndTouchConversation({
			conversation_id: parsedId,
			direction: "outbound",
			role: "human",
			content: content.trim(),
			media_type: mediaType,
			source: "dashboard",
			from_me: true,
			metadata,
		});

		// 2. Encolamos el mensaje en la tabla outbox para que el proceso del bot lo transmita
		await enqueueOutbox(
			parsedId,
			outboxDestinationForConversation(conversation),
			content.trim(),
			{ media_type: mediaType, media_url: mediaUrl, metadata },
		);

		return NextResponse.json({ ok: true, messageId: message.id });
	} catch (error: any) {
		console.error("[api] Error en POST /api/messages/[conversationId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

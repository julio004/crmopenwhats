import {
	redisTurnKeys,
	type CleanupResult,
	type ProcessingState,
	type QueuedTurnMessage,
} from "./redis-turn-state.ts";

type ConversationId = string | number;

export interface RedisAdapterClient {
	set(
		key: string,
		value: string,
		mode?: "EX" | "PX",
		ttl?: number,
		condition?: "NX",
	): Promise<"OK" | null>;
	rpush(key: string, value: string): Promise<number>;
	expire(key: string, seconds: number): Promise<0 | 1 | number>;
	lrange(key: string, start: number, stop: number): Promise<string[]>;
	get(key: string): Promise<string | null>;
	exists(...keys: string[]): Promise<number>;
	del(...keys: string[]): Promise<number>;
	eval(
		script: string,
		numberOfKeys: number,
		...args: Array<string | number>
	): Promise<unknown>;
}

const NEVER_TOUCHES = [
	"postgres",
	"./auth/",
	"baileys-session",
	"durable-conversation-mode",
	"dedupe-keys",
];

const RELEASE_IF_TOKEN_MATCHES_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

const CLEANUP_TURN_IF_TOKEN_MATCHES_LUA = `
if redis.call("GET", KEYS[4]) == ARGV[1] then
	return {
		redis.call("DEL", KEYS[1]),
		redis.call("DEL", KEYS[2]),
		redis.call("DEL", KEYS[3]),
		redis.call("DEL", KEYS[4])
	}
end
return {0, 0, 0, 0}
`;

function parseJsonObject<T extends Record<string, unknown>>(
	raw: string,
): T | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as T)
			: null;
	} catch {
		return null;
	}
}

function parseQueuedTurnMessage(raw: string): QueuedTurnMessage | null {
	const parsed = parseJsonObject<Record<string, unknown>>(raw);
	if (!parsed) return null;
	if (
		typeof parsed.messageId !== "string" ||
		typeof parsed.dbMessageId !== "number" ||
		typeof parsed.text !== "string" ||
		typeof parsed.createdAt !== "string"
	) {
		return null;
	}
	if (
		!["text", "image", "audio", "unknown"].includes(String(parsed.mediaType))
	) {
		return null;
	}
	return parsed as unknown as QueuedTurnMessage;
}

function parseProcessingState(raw: string | null): ProcessingState | null {
	if (!raw) return null;
	const parsed = parseJsonObject<Record<string, unknown>>(raw);
	if (!parsed) return null;
	if (
		typeof parsed.token !== "string" ||
		typeof parsed.startedAt !== "string" ||
		!Array.isArray(parsed.messageIds) ||
		!parsed.messageIds.every((messageId) => typeof messageId === "string")
	) {
		return null;
	}
	return parsed as unknown as ProcessingState;
}

function parseEvalInteger(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number.parseInt(value, 10) || 0;
	return 0;
}

function parseEvalIntegerArray(value: unknown): number[] {
	return Array.isArray(value) ? value.map(parseEvalInteger) : [];
}

async function releaseOwnedLock(
	redis: RedisAdapterClient,
	key: string,
	token: string,
): Promise<boolean> {
	const released = await redis.eval(
		RELEASE_IF_TOKEN_MATCHES_LUA,
		1,
		key,
		token,
	);
	return parseEvalInteger(released) === 1;
}

export function createIoredisTurnState(redis: RedisAdapterClient) {
	return {
		async acceptDedupeMessage(
			whatsappMessageId: string,
			options: { ttlSeconds: number; value?: string | number },
		): Promise<boolean> {
			const result = await redis.set(
				redisTurnKeys.dedupeMessage(whatsappMessageId),
				String(options.value ?? "1"),
				"EX",
				options.ttlSeconds,
				"NX",
			);
			return result === "OK";
		},

		async enqueueTurnMessage(
			conversationId: ConversationId,
			item: QueuedTurnMessage,
			options: { ttlSeconds: number },
		): Promise<void> {
			const key = redisTurnKeys.turnQueue(conversationId);
			await redis.rpush(key, JSON.stringify(item));
			await redis.expire(key, options.ttlSeconds);
		},

		async getQueuedTurnMessages(
			conversationId: ConversationId,
		): Promise<QueuedTurnMessage[]> {
			const rows = await redis.lrange(
				redisTurnKeys.turnQueue(conversationId),
				0,
				-1,
			);
			return rows
				.map(parseQueuedTurnMessage)
				.filter((item): item is QueuedTurnMessage => item !== null);
		},

		async setDebounceMarker(
			conversationId: ConversationId,
			input: { fireAtMs: number; ttlMs: number },
		): Promise<void> {
			await redis.set(
				redisTurnKeys.debounceMarker(conversationId),
				JSON.stringify({ fireAtMs: input.fireAtMs }),
				"PX",
				input.ttlMs,
			);
		},

		async getDebounceMarker(
			conversationId: ConversationId,
		): Promise<number | null> {
			const raw = await redis.get(redisTurnKeys.debounceMarker(conversationId));
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw);
				return typeof parsed?.fireAtMs === "number" ? parsed.fireAtMs : null;
			} catch {
				return null;
			}
		},

		async acquireProcessingLock(
			conversationId: ConversationId,
			token: string,
			options: { ttlMs: number },
		): Promise<boolean> {
			const result = await redis.set(
				redisTurnKeys.turnLock(conversationId),
				token,
				"PX",
				options.ttlMs,
				"NX",
			);
			return result === "OK";
		},

		async releaseProcessingLock(
			conversationId: ConversationId,
			token: string,
		): Promise<boolean> {
			return releaseOwnedLock(
				redis,
				redisTurnKeys.turnLock(conversationId),
				token,
			);
		},

		async setProcessingState(
			conversationId: ConversationId,
			state: ProcessingState,
			options: { ttlMs: number },
		): Promise<void> {
			await redis.set(
				redisTurnKeys.processingMarker(conversationId),
				JSON.stringify(state),
				"PX",
				options.ttlMs,
			);
		},

		async getProcessingState(
			conversationId: ConversationId,
		): Promise<ProcessingState | null> {
			return parseProcessingState(
				await redis.get(redisTurnKeys.processingMarker(conversationId)),
			);
		},

		async hasActiveTurnState(conversationId: ConversationId): Promise<boolean> {
			const count = await redis.exists(
				redisTurnKeys.turnQueue(conversationId),
				redisTurnKeys.debounceMarker(conversationId),
				redisTurnKeys.turnLock(conversationId),
				redisTurnKeys.processingMarker(conversationId),
			);
			return count > 0;
		},

		async acquireFollowupRunnerLock(
			token: string,
			options: { ttlMs: number },
		): Promise<boolean> {
			const result = await redis.set(
				redisTurnKeys.followupRunnerLock(),
				token,
				"PX",
				options.ttlMs,
				"NX",
			);
			return result === "OK";
		},

		async releaseFollowupRunnerLock(token: string): Promise<boolean> {
			return releaseOwnedLock(redis, redisTurnKeys.followupRunnerLock(), token);
		},

		async acquireFollowupConversationLock(
			conversationId: ConversationId,
			token: string,
			options: { ttlMs: number },
		): Promise<boolean> {
			const result = await redis.set(
				redisTurnKeys.followupConversationLock(conversationId),
				token,
				"PX",
				options.ttlMs,
				"NX",
			);
			return result === "OK";
		},

		async releaseFollowupConversationLock(
			conversationId: ConversationId,
			token: string,
		): Promise<boolean> {
			return releaseOwnedLock(
				redis,
				redisTurnKeys.followupConversationLock(conversationId),
				token,
			);
		},

		async cleanupTurnState(
			conversationId: ConversationId,
			token: string,
		): Promise<CleanupResult> {
			const keys = [
				redisTurnKeys.turnQueue(conversationId),
				redisTurnKeys.debounceMarker(conversationId),
				redisTurnKeys.processingMarker(conversationId),
				redisTurnKeys.turnLock(conversationId),
			];
			const removedFlags = parseEvalIntegerArray(
				await redis.eval(CLEANUP_TURN_IF_TOKEN_MATCHES_LUA, 4, ...keys, token),
			);
			const removedKeys = keys.filter((_, index) => removedFlags[index] === 1);
			return {
				removedKeys,
				lockReleased: removedFlags[3] === 1,
				neverTouches: NEVER_TOUCHES,
			};
		},
	};
}

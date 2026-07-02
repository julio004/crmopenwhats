export const REDIS_KEY_PREFIX = "wa:v1:";

type ConversationId = string | number;

type StoredValue = {
	value: unknown;
	ttlMs: number;
};

export interface QueuedTurnMessage {
	messageId: string;
	dbMessageId: number;
	text: string;
	mediaType: "text" | "image" | "audio" | "unknown";
	createdAt: string;
}

export interface ProcessingState {
	token: string;
	startedAt: string;
	messageIds: string[];
}

const id = (conversationId: ConversationId) => String(conversationId);
const key = (suffix: string) => `${REDIS_KEY_PREFIX}${suffix}`;

export const redisTurnKeys = {
	dedupeMessage: (whatsappMessageId: string) =>
		key(`dedupe:msg:${whatsappMessageId}`),
	turnQueue: (conversationId: ConversationId) =>
		key(`turn:queue:${id(conversationId)}`),
	debounceMarker: (conversationId: ConversationId) =>
		key(`turn:debounce:${id(conversationId)}`),
	turnLock: (conversationId: ConversationId) =>
		key(`turn:lock:${id(conversationId)}`),
	processingMarker: (conversationId: ConversationId) =>
		key(`turn:processing:${id(conversationId)}`),
	followupRunnerLock: () => key("followups:runner-lock"),
	followupConversationLock: (conversationId: ConversationId) =>
		key(`followups:lock:${id(conversationId)}`),
	forConversation(conversationId: ConversationId) {
		return {
			dedupeMessage: undefined,
			turnQueue: this.turnQueue(conversationId),
			debounceMarker: this.debounceMarker(conversationId),
			turnLock: this.turnLock(conversationId),
			processingMarker: this.processingMarker(conversationId),
			followupConversationLock: this.followupConversationLock(conversationId),
		};
	},
};

export interface CleanupResult {
	removedKeys: string[];
	lockReleased: boolean;
	neverTouches: string[];
}

function cloneValue<T>(value: T): T {
	return globalThis.structuredClone
		? globalThis.structuredClone(value)
		: JSON.parse(JSON.stringify(value));
}

export function createInMemoryTurnState() {
	const store = new Map<string, StoredValue>();

	const setIfAbsent = (
		redisKey: string,
		value: unknown,
		ttlMs: number,
	): boolean => {
		if (store.has(redisKey)) return false;
		store.set(redisKey, { value: cloneValue(value), ttlMs });
		return true;
	};
	const set = (redisKey: string, value: unknown, ttlMs: number): void => {
		store.set(redisKey, { value: cloneValue(value), ttlMs });
	};
	const releaseOwnedLock = (redisKey: string, token: string): boolean => {
		const current = store.get(redisKey);
		if (!current || current.value !== token) return false;
		store.delete(redisKey);
		return true;
	};

	return {
		inspectKey(redisKey: string): StoredValue | null {
			const current = store.get(redisKey);
			return current
				? { value: cloneValue(current.value), ttlMs: current.ttlMs }
				: null;
		},
		acceptDedupeMessage(
			whatsappMessageId: string,
			options: { ttlSeconds: number; value?: string | number },
		): boolean {
			return setIfAbsent(
				redisTurnKeys.dedupeMessage(whatsappMessageId),
				options.value ?? "1",
				options.ttlSeconds * 1000,
			);
		},
		enqueueTurnMessage(
			conversationId: ConversationId,
			item: QueuedTurnMessage,
			options: { ttlSeconds: number },
		): void {
			const redisKey = redisTurnKeys.turnQueue(conversationId);
			const existing = store.get(redisKey)?.value;
			const queue = Array.isArray(existing)
				? (cloneValue(existing) as QueuedTurnMessage[])
				: [];
			queue.push(cloneValue(item));
			set(redisKey, queue, options.ttlSeconds * 1000);
		},
		getQueuedTurnMessages(conversationId: ConversationId): QueuedTurnMessage[] {
			const value = store.get(redisTurnKeys.turnQueue(conversationId))?.value;
			return Array.isArray(value)
				? (cloneValue(value) as QueuedTurnMessage[])
				: [];
		},
		setDebounceMarker(
			conversationId: ConversationId,
			input: { fireAtMs: number; ttlMs: number },
		): void {
			set(
				redisTurnKeys.debounceMarker(conversationId),
				input.fireAtMs,
				input.ttlMs,
			);
		},
		getDebounceMarker(conversationId: ConversationId): number | null {
			const value = store.get(redisTurnKeys.debounceMarker(conversationId))?.value;
			return typeof value === "number" ? value : null;
		},
		acquireProcessingLock(
			conversationId: ConversationId,
			token: string,
			options: { ttlMs: number },
		): boolean {
			return setIfAbsent(
				redisTurnKeys.turnLock(conversationId),
				token,
				options.ttlMs,
			);
		},
		releaseProcessingLock(
			conversationId: ConversationId,
			token: string,
		): boolean {
			return releaseOwnedLock(redisTurnKeys.turnLock(conversationId), token);
		},
		setProcessingState(
			conversationId: ConversationId,
			state: ProcessingState,
			options: { ttlMs: number },
		): void {
			set(redisTurnKeys.processingMarker(conversationId), state, options.ttlMs);
		},
		getProcessingState(conversationId: ConversationId): ProcessingState | null {
			return (
				(store.get(redisTurnKeys.processingMarker(conversationId))?.value as
					| ProcessingState
					| undefined) ?? null
			);
		},
		hasActiveTurnState(conversationId: ConversationId): boolean {
			return [
				redisTurnKeys.turnQueue(conversationId),
				redisTurnKeys.debounceMarker(conversationId),
				redisTurnKeys.turnLock(conversationId),
				redisTurnKeys.processingMarker(conversationId),
			].some((redisKey) => store.has(redisKey));
		},
		acquireFollowupRunnerLock(
			token: string,
			options: { ttlMs: number },
		): boolean {
			return setIfAbsent(
				redisTurnKeys.followupRunnerLock(),
				token,
				options.ttlMs,
			);
		},
		releaseFollowupRunnerLock(token: string): boolean {
			return releaseOwnedLock(redisTurnKeys.followupRunnerLock(), token);
		},
		acquireFollowupConversationLock(
			conversationId: ConversationId,
			token: string,
			options: { ttlMs: number },
		): boolean {
			return setIfAbsent(
				redisTurnKeys.followupConversationLock(conversationId),
				token,
				options.ttlMs,
			);
		},
		releaseFollowupConversationLock(
			conversationId: ConversationId,
			token: string,
		): boolean {
			return releaseOwnedLock(
				redisTurnKeys.followupConversationLock(conversationId),
				token,
			);
		},
		cleanupTurnState(
			conversationId: ConversationId,
			token: string,
		): CleanupResult {
			const removedKeys: string[] = [];
			const lockKey = redisTurnKeys.turnLock(conversationId);
			const currentLock = store.get(lockKey);
			const ownsLock = currentLock?.value === token;
			if (ownsLock) {
				for (const redisKey of [
					redisTurnKeys.turnQueue(conversationId),
					redisTurnKeys.debounceMarker(conversationId),
					redisTurnKeys.processingMarker(conversationId),
				]) {
					if (store.delete(redisKey)) removedKeys.push(redisKey);
				}
			}
			const lockReleased = ownsLock ? releaseOwnedLock(lockKey, token) : false;
			if (lockReleased) removedKeys.push(lockKey);
			return {
				removedKeys,
				lockReleased,
				neverTouches: [
					"postgres",
					"./auth/",
					"baileys-session",
					"durable-conversation-mode",
					"dedupe-keys",
				],
			};
		},
	};
}

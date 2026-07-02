import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	REDIS_KEY_PREFIX,
	createInMemoryTurnState,
	redisTurnKeys,
	type QueuedTurnMessage,
} from "../src/lib/redis-turn-state.ts";

const queued = (id: string): QueuedTurnMessage => ({
	messageId: id,
	dbMessageId: Number(id.replace(/\D/g, "")) || 1,
	text: `mensaje ${id}`,
	mediaType: "text",
	createdAt: "2026-06-01T12:00:00.000Z",
});

describe("Redis turn-state key contract", () => {
	it("uses wa:v1 prefix for all transient and lock keys", () => {
		assert.equal(REDIS_KEY_PREFIX, "wa:v1:");
		assert.deepEqual(redisTurnKeys.forConversation("42"), {
			dedupeMessage: undefined,
			turnQueue: "wa:v1:turn:queue:42",
			debounceMarker: "wa:v1:turn:debounce:42",
			turnLock: "wa:v1:turn:lock:42",
			processingMarker: "wa:v1:turn:processing:42",
			followupConversationLock: "wa:v1:followups:lock:42",
		});
		assert.equal(
			redisTurnKeys.dedupeMessage("wamid-1"),
			"wa:v1:dedupe:msg:wamid-1",
		);
		assert.equal(
			redisTurnKeys.followupRunnerLock(),
			"wa:v1:followups:runner-lock",
		);
	});
});

describe("in-memory Redis turn-state contract", () => {
	it("accepts a message id once using NX semantics and TTL intent", () => {
		const store = createInMemoryTurnState();
		assert.equal(
			store.acceptDedupeMessage("wamid-1", { ttlSeconds: 86_400 }),
			true,
		);
		assert.equal(
			store.acceptDedupeMessage("wamid-1", { ttlSeconds: 86_400 }),
			false,
		);
		assert.deepEqual(store.inspectKey(redisTurnKeys.dedupeMessage("wamid-1")), {
			value: "1",
			ttlMs: 86_400_000,
		});
	});

	it("stores debounce queue items per conversation and refreshes TTL intent", () => {
		const store = createInMemoryTurnState();
		store.enqueueTurnMessage("42", queued("m1"), { ttlSeconds: 300 });
		store.enqueueTurnMessage("42", queued("m2"), { ttlSeconds: 300 });

		assert.deepEqual(
			store.getQueuedTurnMessages("42").map((item) => item.messageId),
			["m1", "m2"],
		);
		assert.deepEqual(store.inspectKey(redisTurnKeys.turnQueue("42")), {
			value: [queued("m1"), queued("m2")],
			ttlMs: 300_000,
		});

		store.setDebounceMarker("42", { fireAtMs: 1_800, ttlMs: 72_000 });
		assert.deepEqual(store.inspectKey(redisTurnKeys.debounceMarker("42")), {
			value: 1_800,
			ttlMs: 72_000,
		});
	});

	it("uses token-owned processing locks and refuses wrong-token release", () => {
		const store = createInMemoryTurnState();
		assert.equal(
			store.acquireProcessingLock("42", "token-a", { ttlMs: 90_000 }),
			true,
		);
		assert.equal(
			store.acquireProcessingLock("42", "token-b", { ttlMs: 90_000 }),
			false,
		);
		assert.equal(store.releaseProcessingLock("42", "token-b"), false);
		assert.deepEqual(store.inspectKey(redisTurnKeys.turnLock("42")), {
			value: "token-a",
			ttlMs: 90_000,
		});
		assert.equal(store.releaseProcessingLock("42", "token-a"), true);
		assert.equal(store.inspectKey(redisTurnKeys.turnLock("42")), null);
	});

	it("stores processing markers visible for follow-up collision checks", () => {
		const store = createInMemoryTurnState();
		assert.equal(store.hasActiveTurnState("42"), false);
		store.setProcessingState(
			"42",
			{
				token: "token-a",
				startedAt: "2026-06-01T12:00:00.000Z",
				messageIds: ["m1", "m2"],
			},
			{ ttlMs: 95_000 },
		);
		assert.deepEqual(store.getProcessingState("42"), {
			token: "token-a",
			startedAt: "2026-06-01T12:00:00.000Z",
			messageIds: ["m1", "m2"],
		});
		assert.equal(store.hasActiveTurnState("42"), true);
	});

	it("uses separate keys and tokens for follow-up runner and conversation locks", () => {
		const store = createInMemoryTurnState();
		assert.equal(
			store.acquireFollowupRunnerLock("runner-token", { ttlMs: 300_000 }),
			true,
		);
		assert.equal(
			store.acquireFollowupRunnerLock("other-runner", { ttlMs: 300_000 }),
			false,
		);
		assert.equal(
			store.acquireFollowupConversationLock("42", "follow-token", {
				ttlMs: 120_000,
			}),
			true,
		);
		assert.equal(
			store.acquireFollowupConversationLock("42", "other-follow", {
				ttlMs: 120_000,
			}),
			false,
		);

		assert.deepEqual(store.inspectKey(redisTurnKeys.followupRunnerLock()), {
			value: "runner-token",
			ttlMs: 300_000,
		});
		assert.deepEqual(
			store.inspectKey(redisTurnKeys.followupConversationLock("42")),
			{
				value: "follow-token",
				ttlMs: 120_000,
			},
		);
	});

	it("cleans only transient turn state and owned locks, never durable/auth/dedupe state", () => {
		const store = createInMemoryTurnState();
		store.acceptDedupeMessage("wamid-1", { ttlSeconds: 86_400 });
		store.enqueueTurnMessage("42", queued("m1"), { ttlSeconds: 300 });
		store.setDebounceMarker("42", { fireAtMs: 1_800, ttlMs: 72_000 });
		store.acquireProcessingLock("42", "token-a", { ttlMs: 90_000 });
		store.setProcessingState(
			"42",
			{ token: "token-a", startedAt: "now", messageIds: ["m1"] },
			{ ttlMs: 95_000 },
		);

		const wrongTokenCleanup = store.cleanupTurnState("42", "wrong-token");
		assert.equal(wrongTokenCleanup.lockReleased, false);
		assert.deepEqual(wrongTokenCleanup.removedKeys, []);
		assert.equal(
			store.inspectKey(redisTurnKeys.turnLock("42"))?.value,
			"token-a",
		);
		assert.notEqual(store.inspectKey(redisTurnKeys.turnQueue("42")), null);
		assert.notEqual(store.inspectKey(redisTurnKeys.debounceMarker("42")), null);
		assert.notEqual(
			store.inspectKey(redisTurnKeys.processingMarker("42")),
			null,
		);

		const ownedCleanup = store.cleanupTurnState("42", "token-a");
		assert.equal(ownedCleanup.lockReleased, true);
		assert.equal(store.inspectKey(redisTurnKeys.turnLock("42")), null);
		assert.equal(
			store.inspectKey(redisTurnKeys.dedupeMessage("wamid-1"))?.value,
			"1",
		);
		assert.deepEqual(ownedCleanup.neverTouches, [
			"postgres",
			"./auth/",
			"baileys-session",
			"durable-conversation-mode",
			"dedupe-keys",
		]);
		assert.ok(
			!ownedCleanup.removedKeys.includes(
				redisTurnKeys.dedupeMessage("wamid-1"),
			),
		);
	});
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createIoredisTurnState,
	type RedisAdapterClient,
} from "../src/lib/redis-adapter.ts";
import {
	redisTurnKeys,
	type ProcessingState,
	type QueuedTurnMessage,
} from "../src/lib/redis-turn-state.ts";

const queued = (id: string): QueuedTurnMessage => ({
	messageId: id,
	dbMessageId: Number(id.replace(/\D/g, "")) || 1,
	text: `mensaje ${id}`,
	mediaType: "text",
	createdAt: "2026-06-01T12:00:00.000Z",
});

type Entry =
	| {
			kind: "string";
			value: string;
			ttl?: { mode: "EX" | "PX"; value: number };
	  }
	| {
			kind: "list";
			values: string[];
			ttl?: { mode: "EX" | "PX"; value: number };
	  };

class FakeRedis implements RedisAdapterClient {
	readonly store = new Map<string, Entry>();
	readonly calls: Array<{ command: string; args: unknown[] }> = [];

	async set(
		key: string,
		value: string,
		mode?: "EX" | "PX",
		ttl?: number,
		condition?: "NX",
	): Promise<"OK" | null> {
		this.calls.push({
			command: "set",
			args: [key, value, mode, ttl, condition],
		});
		if (condition === "NX" && this.store.has(key)) return null;
		this.store.set(key, {
			kind: "string",
			value,
			ttl: mode && ttl !== undefined ? { mode, value: ttl } : undefined,
		});
		return "OK";
	}

	async rpush(key: string, value: string): Promise<number> {
		this.calls.push({ command: "rpush", args: [key, value] });
		const current = this.store.get(key);
		const values = current?.kind === "list" ? [...current.values] : [];
		values.push(value);
		this.store.set(key, { kind: "list", values, ttl: current?.ttl });
		return values.length;
	}

	async expire(key: string, seconds: number): Promise<0 | 1> {
		this.calls.push({ command: "expire", args: [key, seconds] });
		const current = this.store.get(key);
		if (!current) return 0;
		current.ttl = { mode: "EX", value: seconds };
		return 1;
	}

	async lrange(key: string, start: number, stop: number): Promise<string[]> {
		this.calls.push({ command: "lrange", args: [key, start, stop] });
		const current = this.store.get(key);
		if (current?.kind !== "list") return [];
		const normalizedStop = stop === -1 ? current.values.length : stop + 1;
		return current.values.slice(start, normalizedStop);
	}

	async get(key: string): Promise<string | null> {
		this.calls.push({ command: "get", args: [key] });
		const current = this.store.get(key);
		return current?.kind === "string" ? current.value : null;
	}

	async exists(...keys: string[]): Promise<number> {
		this.calls.push({ command: "exists", args: keys });
		return keys.filter((key) => this.store.has(key)).length;
	}

	async del(...keys: string[]): Promise<number> {
		this.calls.push({ command: "del", args: keys });
		let removed = 0;
		for (const key of keys) {
			if (this.store.delete(key)) removed += 1;
		}
		return removed;
	}

	async eval(
		_script: string,
		numberOfKeys: number,
		...args: Array<string | number>
	): Promise<unknown> {
		this.calls.push({
			command: "eval",
			args: [_script, numberOfKeys, ...args],
		});
		const keys = args.slice(0, numberOfKeys).map(String);
		const token = String(args[numberOfKeys]);
		if (numberOfKeys === 1) {
			const current = this.store.get(keys[0]);
			if (current?.kind !== "string" || current.value !== token) return 0;
			this.store.delete(keys[0]);
			return 1;
		}
		if (numberOfKeys === 4) {
			const lock = this.store.get(keys[3]);
			if (lock?.kind !== "string" || lock.value !== token) return [0, 0, 0, 0];
			return keys.map((key) => (this.store.delete(key) ? 1 : 0));
		}
		throw new Error(`unexpected eval key count ${numberOfKeys}`);
	}
}

describe("ioredis Redis turn-state adapter", () => {
	it("dedupes with atomic SET EX NX", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);

		assert.equal(
			await turnState.acceptDedupeMessage("wamid-1", {
				ttlSeconds: 86_400,
				value: "seen",
			}),
			true,
		);
		assert.equal(
			await turnState.acceptDedupeMessage("wamid-1", { ttlSeconds: 86_400 }),
			false,
		);

		assert.deepEqual(redis.calls[0], {
			command: "set",
			args: [
				redisTurnKeys.dedupeMessage("wamid-1"),
				"seen",
				"EX",
				86_400,
				"NX",
			],
		});
	});

	it("appends queued turn messages with list ops and refreshes TTL", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);

		await turnState.enqueueTurnMessage("42", queued("m1"), { ttlSeconds: 300 });
		await turnState.enqueueTurnMessage("42", queued("m2"), { ttlSeconds: 300 });
		redis.store.set(redisTurnKeys.turnQueue("42"), {
			kind: "list",
			values: [
				JSON.stringify(queued("m1")),
				"not-json",
				JSON.stringify(queued("m2")),
			],
			ttl: { mode: "EX", value: 300 },
		});

		assert.deepEqual(
			(await turnState.getQueuedTurnMessages("42")).map(
				(item) => item.messageId,
			),
			["m1", "m2"],
		);
		assert.deepEqual(
			redis.calls
				.filter((call) => call.command === "rpush")
				.map((call) => call.args[0]),
			[redisTurnKeys.turnQueue("42"), redisTurnKeys.turnQueue("42")],
		);
		assert.deepEqual(redis.store.get(redisTurnKeys.turnQueue("42"))?.ttl, {
			mode: "EX",
			value: 300,
		});
	});

	it("stores debounce and processing markers as JSON with PX TTL", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);
		const processing: ProcessingState = {
			token: "token-a",
			startedAt: "2026-06-01T12:00:00.000Z",
			messageIds: ["m1", "m2"],
		};

		await turnState.setDebounceMarker("42", { fireAtMs: 1_800, ttlMs: 72_000 });
		await turnState.setProcessingState("42", processing, { ttlMs: 95_000 });
		assert.deepEqual(await turnState.getProcessingState("42"), processing);

		assert.deepEqual(redis.calls[0], {
			command: "set",
			args: [
				redisTurnKeys.debounceMarker("42"),
				JSON.stringify({ fireAtMs: 1_800 }),
				"PX",
				72_000,
				undefined,
			],
		});
		assert.equal(
			redis.store.get(redisTurnKeys.processingMarker("42"))?.ttl?.value,
			95_000,
		);
	});

	it("uses token-owned processing and follow-up locks with atomic Lua release", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);

		assert.equal(
			await turnState.acquireProcessingLock("42", "token-a", { ttlMs: 90_000 }),
			true,
		);
		assert.equal(
			await turnState.acquireProcessingLock("42", "token-b", { ttlMs: 90_000 }),
			false,
		);
		assert.equal(await turnState.releaseProcessingLock("42", "token-b"), false);
		assert.equal(await turnState.releaseProcessingLock("42", "token-a"), true);
		assert.equal(
			await turnState.acquireFollowupRunnerLock("runner", { ttlMs: 300_000 }),
			true,
		);
		assert.equal(await turnState.releaseFollowupRunnerLock("runner"), true);
		assert.equal(
			await turnState.acquireFollowupConversationLock("42", "follow", {
				ttlMs: 120_000,
			}),
			true,
		);
		assert.equal(
			await turnState.releaseFollowupConversationLock("42", "follow"),
			true,
		);

		assert.ok(redis.calls.some((call) => call.command === "eval"));
	});

	it("detects active turn state from queue, debounce, lock, or processing marker", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);
		assert.equal(await turnState.hasActiveTurnState("42"), false);
		await turnState.enqueueTurnMessage("42", queued("m1"), { ttlSeconds: 300 });
		assert.equal(await turnState.hasActiveTurnState("42"), true);
	});

	it("cleans only owned transient turn state and never durable/auth/dedupe keys", async () => {
		const redis = new FakeRedis();
		const turnState = createIoredisTurnState(redis);
		await turnState.acceptDedupeMessage("wamid-1", { ttlSeconds: 86_400 });
		await turnState.enqueueTurnMessage("42", queued("m1"), { ttlSeconds: 300 });
		await turnState.setDebounceMarker("42", { fireAtMs: 1_800, ttlMs: 72_000 });
		await turnState.acquireProcessingLock("42", "token-a", { ttlMs: 90_000 });
		await turnState.setProcessingState(
			"42",
			{ token: "token-a", startedAt: "now", messageIds: ["m1"] },
			{ ttlMs: 95_000 },
		);

		const wrongTokenCleanup = await turnState.cleanupTurnState(
			"42",
			"wrong-token",
		);
		assert.equal(wrongTokenCleanup.lockReleased, false);
		assert.deepEqual(wrongTokenCleanup.removedKeys, []);
		assert.notEqual(redis.store.get(redisTurnKeys.turnQueue("42")), undefined);

		const ownedCleanup = await turnState.cleanupTurnState("42", "token-a");
		assert.equal(ownedCleanup.lockReleased, true);
		assert.equal(redis.store.has(redisTurnKeys.dedupeMessage("wamid-1")), true);
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

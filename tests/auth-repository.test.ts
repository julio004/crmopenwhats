import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DATABASE_SCHEMA_SQL } from "../src/lib/db-contract.ts";
import {
	createInMemoryAuthRepository,
	createPostgresAuthRepository,
} from "../src/lib/repositories/auth-repository.ts";

class FakePg {
	calls: { text: string; values?: unknown[] }[] = [];
	private responders: ((text: string, values?: unknown[]) => { rows: unknown[] })[] = [];

	respondWith(responder: (text: string, values?: unknown[]) => { rows: unknown[] }) {
		this.responders.push(responder);
	}

	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		this.calls.push({ text, values: values ? [...values] : undefined });
		const responder = this.responders.shift();
		return (responder ? responder(text, values ? [...values] : undefined) : { rows: [] }) as { rows: T[] };
	}
}

describe("auth repository schema", () => {
	it("declares durable auth and audit tables", () => {
		for (const fragment of [
			"CREATE TABLE IF NOT EXISTS users",
			"email TEXT UNIQUE NOT NULL",
			"status TEXT CHECK(status IN ('active','disabled')) NOT NULL DEFAULT 'active'",
			"CREATE TABLE IF NOT EXISTS teams",
			"CREATE TABLE IF NOT EXISTS team_memberships",
			"role TEXT CHECK(role IN ('owner','manager','agent','viewer')) NOT NULL",
			"UNIQUE(team_id, user_id)",
			"CREATE TABLE IF NOT EXISTS user_password_credentials",
			"password_hash TEXT NOT NULL",
			"CREATE TABLE IF NOT EXISTS user_sessions",
			"session_token_hash TEXT UNIQUE NOT NULL",
			"expires_at TIMESTAMP WITH TIME ZONE NOT NULL",
			"CREATE TABLE IF NOT EXISTS audit_events",
			"before_json JSONB NOT NULL DEFAULT '{}'::jsonb",
			"after_json JSONB NOT NULL DEFAULT '{}'::jsonb",
		]) {
			assert.match(
				DATABASE_SCHEMA_SQL,
				new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			);
		}
	});
});

describe("in-memory auth repository", () => {
	it("stores users, credentials, memberships, and audit events", async () => {
		const repo = createInMemoryAuthRepository();
		const team = await repo.createTeam({ name: "Core" });
		const user = await repo.createUser({ email: " OWNER@example.com ", display_name: "Owner" });
		const credential = await repo.upsertPasswordCredential({
			user_id: user.id,
			password_hash: "hash-1",
		});
		const membership = await repo.addTeamMembership({ team_id: team.id, user_id: user.id, role: "owner" });
		const audit = await repo.recordAuditEvent({
			actor_user_id: user.id,
			team_id: team.id,
			entity_type: "team_membership",
			entity_id: String(membership.id),
			action: "membership.created",
			after_json: { role: "owner" },
		});

		assert.equal((await repo.findUserByEmail("owner@example.com"))?.id, user.id);
		assert.equal(credential.password_hash, "hash-1");
		assert.equal((await repo.listTeamMembershipsByUserId(user.id))[0]?.role, "owner");
		assert.equal(audit.action, "membership.created");
		assert.equal(await repo.countUsers(), 1);
	});

	it("creates and revokes hashed sessions by token hash", async () => {
		const repo = createInMemoryAuthRepository();
		const user = await repo.createUser({ email: "agent@example.com" });
		const expiresAt = new Date("2026-06-30T00:00:00.000Z");
		const created = await repo.createSession({
			user_id: user.id,
			session_token_hash: "session-hash",
			expires_at: expiresAt,
		});

		assert.equal((await repo.getSessionByTokenHash("session-hash"))?.id, created.id);
		const revoked = await repo.revokeSessionByTokenHash("session-hash");
		assert.ok(revoked?.revoked_at instanceof Date);
		assert.equal((await repo.getSessionByTokenHash("session-hash"))?.revoked_at?.toISOString(), revoked?.revoked_at?.toISOString());
	});
});

describe("postgres auth repository", () => {
	it("persists sessions and revocations with durable SQL boundaries", async () => {
		const pg = new FakePg();
		const expiresAt = new Date("2026-06-30T00:00:00.000Z");
		const revokedAt = new Date("2026-06-30T02:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO user_sessions/);
			assert.equal(values?.[0], 3);
			assert.equal(values?.[1], "session-hash");
			assert.equal((values?.[2] as Date)?.toISOString(), expiresAt.toISOString());
			assert.ok(values?.[3] instanceof Date);
			return { rows: [{ id: 9, user_id: 3, session_token_hash: "session-hash", expires_at: expiresAt, revoked_at: null, created_at: expiresAt }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /UPDATE user_sessions/);
			assert.match(text, /WHERE session_token_hash = \$1/);
			assert.deepEqual(values, ["session-hash", revokedAt]);
			return { rows: [{ id: 9, user_id: 3, session_token_hash: "session-hash", expires_at: expiresAt, revoked_at: revokedAt, created_at: expiresAt }] };
		});
		const repo = createPostgresAuthRepository(pg);

		await repo.createSession({ user_id: 3, session_token_hash: "session-hash", expires_at: expiresAt });
		const revoked = await repo.revokeSessionByTokenHash("session-hash", revokedAt);

		assert.equal(revoked?.revoked_at?.toISOString(), revokedAt.toISOString());
	});
});

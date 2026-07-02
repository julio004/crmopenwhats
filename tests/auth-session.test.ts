import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bootstrapAuthOwner } from "../src/lib/auth/bootstrap.ts";
import {
	createSessionService,
	getSessionFromRequest,
	hashSessionToken,
	requireRole,
	requireSession,
} from "../src/lib/auth/session.ts";
import { createInMemoryAuthRepository } from "../src/lib/repositories/auth-repository.ts";

const NOW = new Date("2026-06-04T21:00:00.000Z");

function makeRequest(token?: string) {
	return new Request("http://localhost/api/settings", {
		headers: token ? { cookie: `bot_session=${token}` } : undefined,
	});
}

describe("auth session runtime", () => {
	it("creates opaque durable sessions and resolves request context", async () => {
		const repo = createInMemoryAuthRepository();
		await bootstrapAuthOwner({
			repo,
			adminEmail: "owner@example.com",
			adminPassword: "top-secret",
			teamName: "Bot Personal",
		});

		const service = createSessionService({
			repo,
			now: () => NOW,
			randomToken: () => "opaque-session-token",
			sessionTtlMs: 60 * 60 * 1000,
		});

		const login = await service.login({
			email: "owner@example.com",
			password: "top-secret",
			requestMetadata: { ip: "127.0.0.1" },
		});

		assert.equal(login.status, "authenticated");
		assert.equal(login.token, "opaque-session-token");
		assert.equal(hashSessionToken("opaque-session-token"), login.session.session_token_hash);
		assert.notEqual(login.session.session_token_hash, "top-secret");

		const context = await getSessionFromRequest(makeRequest("opaque-session-token"), {
			repo,
			now: () => NOW,
		});

		assert.ok(context);
		assert.equal(context?.user.email, "owner@example.com");
		assert.equal(context?.role, "owner");
		assert.equal(context?.teamId, 1);
	});

	it("rejects missing, expired, and revoked sessions", async () => {
		const repo = createInMemoryAuthRepository();
		await bootstrapAuthOwner({
			repo,
			adminEmail: "owner@example.com",
			adminPassword: "top-secret",
		});
		const service = createSessionService({
			repo,
			now: () => NOW,
			randomToken: () => "short-lived-token",
			sessionTtlMs: 1_000,
		});
		await service.login({ email: "owner@example.com", password: "top-secret" });

		assert.equal(await getSessionFromRequest(makeRequest(), { repo, now: () => NOW }), null);
		assert.equal(
			await getSessionFromRequest(makeRequest("short-lived-token"), {
				repo,
				now: () => new Date(NOW.getTime() + 2_000),
			}),
			null,
		);

		await service.revokeFromRequest(makeRequest("short-lived-token"), {
			requestMetadata: { reason: "logout" },
		});
		await assert.rejects(
			() => requireSession(makeRequest("short-lived-token"), { repo, now: () => NOW }),
			(error: any) => error?.status === 401 && error?.message === "auth_unauthorized",
		);
	});

	it("enforces minimum role hierarchy for protected handlers", async () => {
		const repo = createInMemoryAuthRepository();
		const team = await repo.createTeam({ name: "Core" });
		const user = await repo.createUser({ email: "viewer@example.com" });
		await repo.addTeamMembership({ team_id: team.id, user_id: user.id, role: "viewer" });
		const service = createSessionService({
			repo,
			now: () => NOW,
			randomToken: () => "viewer-token",
		});
		const credentialUser = await repo.findUserByEmail("viewer@example.com");
		assert.ok(credentialUser);

		await repo.upsertPasswordCredential({
			user_id: credentialUser!.id,
			password_hash: "scrypt:deadbeef:deadbeef",
		});

		const session = await repo.createSession({
			user_id: credentialUser!.id,
			session_token_hash: hashSessionToken("viewer-token"),
			expires_at: new Date(NOW.getTime() + 60_000),
		});
		assert.ok(session.id > 0);

		const context = await requireSession(makeRequest("viewer-token"), { repo, now: () => NOW });
		assert.equal(context.role, "viewer");
		await assert.rejects(
			() => requireRole(context, "manager"),
			(error: any) => error?.status === 403 && error?.message === "auth_forbidden",
		);
		assert.equal((await requireRole(context, "viewer")).role, "viewer");
	});
});

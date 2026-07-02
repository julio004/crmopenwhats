import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { bootstrapAuthOwner } from "../src/lib/auth/bootstrap.ts";
import { createSessionService } from "../src/lib/auth/session.ts";
import { createLoginRoute } from "../src/app/api/auth/login/route.ts";
import { createLogoutRoute } from "../src/app/api/auth/logout/route.ts";
import { proxy } from "../src/proxy.ts";
import { createInMemoryAuthRepository } from "../src/lib/repositories/auth-repository.ts";

const NOW = new Date("2026-06-04T21:00:00.000Z");

describe("auth routes and proxy", () => {
	it("logs in against DB credentials and sets an opaque cookie", async () => {
		const repo = createInMemoryAuthRepository();
		await bootstrapAuthOwner({
			repo,
			adminEmail: "owner@example.com",
			adminPassword: "top-secret",
		});
		const POST = createLoginRoute({
			repo,
			now: () => NOW,
			randomToken: () => "cookie-token",
		});

		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "owner@example.com", password: "top-secret" }),
			}),
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { success: true });
		const cookie = response.headers.get("set-cookie") ?? "";
		assert.match(cookie, /bot_session=cookie-token/);
		assert.doesNotMatch(cookie, /top-secret/);
	});

	it("rejects invalid credentials and logout revokes the durable session", async () => {
		const repo = createInMemoryAuthRepository();
		await bootstrapAuthOwner({
			repo,
			adminEmail: "owner@example.com",
			adminPassword: "top-secret",
		});
		const login = createLoginRoute({
			repo,
			now: () => NOW,
			randomToken: () => "logout-token",
		});
		const failed = await login(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "owner@example.com", password: "wrong" }),
			}),
		);
		assert.equal(failed.status, 401);
		assert.equal(failed.headers.get("set-cookie"), null);

		const ok = await login(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "owner@example.com", password: "top-secret" }),
			}),
		);
		assert.equal(ok.status, 200);

		const logout = createLogoutRoute({ repo, now: () => NOW });
		const loggedOut = await logout(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
				headers: { cookie: "bot_session=logout-token" },
			}),
		);

		assert.equal(loggedOut.status, 200);
		assert.match(loggedOut.headers.get("set-cookie") ?? "", /bot_session=;/);
		const service = createSessionService({ repo, now: () => NOW });
		assert.equal(await service.getSessionFromRequest(new Request("http://localhost/api/secure", { headers: { cookie: "bot_session=logout-token" } })), null);
	});

	it("gates unauthenticated API/page requests while allowing public auth routes", () => {
		const apiRequest = new NextRequest("http://localhost/api/settings");
		const apiResponse = proxy(apiRequest);
		assert.equal(apiResponse.status, 401);

		const pageRequest = new NextRequest("http://localhost/");
		const pageResponse = proxy(pageRequest);
		assert.equal(pageResponse.status, 307);
		assert.equal(pageResponse.headers.get("location"), "http://localhost/login");

		const loginRequest = new NextRequest("http://localhost/login");
		assert.equal(proxy(loginRequest).status, 200);

		const publicAuthRequest = new NextRequest("http://localhost/api/auth/login");
		assert.equal(proxy(publicAuthRequest).status, 200);
	});
});

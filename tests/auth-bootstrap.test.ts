import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapAuthOwner } from "../src/lib/auth/bootstrap.ts";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.ts";
import { createInMemoryAuthRepository } from "../src/lib/repositories/auth-repository.ts";

describe("auth password helpers", () => {
	it("hashes and verifies passwords without storing raw values", async () => {
		const hash = await hashPassword("super-secret");

		assert.notEqual(hash, "super-secret");
		assert.equal(await verifyPassword("super-secret", hash), true);
		assert.equal(await verifyPassword("wrong", hash), false);
	});
});

describe("auth bootstrap", () => {
	it("seeds the first owner account from admin env inputs", async () => {
		const repo = createInMemoryAuthRepository();
		const result = await bootstrapAuthOwner({
			repo,
			adminEmail: "admin@example.com",
			adminPassword: "top-secret",
			teamName: "Bot Personal",
		});

		assert.equal(result.status, "created");
		assert.equal(await repo.countUsers(), 1);
		const user = await repo.findUserByEmail("admin@example.com");
		assert.ok(user);
		const credential = await repo.getPasswordCredentialByUserId(user!.id);
		assert.ok(credential);
		assert.equal(await verifyPassword("top-secret", credential!.password_hash), true);
		assert.equal((await repo.listTeamMembershipsByUserId(user!.id))[0]?.role, "owner");
		assert.equal((await repo.listAuditEvents!())[0]?.action, "auth.bootstrap_owner_created");
	});

	it("skips bootstrap when users already exist", async () => {
		const repo = createInMemoryAuthRepository();
		await repo.createUser({ email: "existing@example.com" });

		const result = await bootstrapAuthOwner({
			repo,
			adminEmail: "admin@example.com",
			adminPassword: "top-secret",
		});

		assert.equal(result.status, "skipped_existing_users");
		assert.equal(await repo.countUsers(), 1);
	});
});

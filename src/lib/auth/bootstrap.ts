import type { AuthRepository } from "../repositories/auth-repository.ts";
import { hashPassword } from "./password.ts";

export async function bootstrapAuthOwner(input: {
	repo: AuthRepository;
	adminEmail?: string | null;
	adminPassword?: string | null;
	teamName?: string;
}) {
	if (!input.adminEmail?.trim() || !input.adminPassword?.trim()) {
		return { status: "missing_config" as const };
	}
	if ((await input.repo.countUsers()) > 0) {
		return { status: "skipped_existing_users" as const };
	}

	const team = await input.repo.createTeam({ name: input.teamName ?? "Default Team" });
	const user = await input.repo.createUser({ email: input.adminEmail, status: "active" });
	const membership = await input.repo.addTeamMembership({
		team_id: team.id,
		user_id: user.id,
		role: "owner",
	});
	await input.repo.upsertPasswordCredential({
		user_id: user.id,
		password_hash: await hashPassword(input.adminPassword),
	});
	await input.repo.recordAuditEvent({
		actor_user_id: user.id,
		team_id: team.id,
		entity_type: "user",
		entity_id: String(user.id),
		action: "auth.bootstrap_owner_created",
		after_json: { teamId: team.id, membershipId: membership.id, role: membership.role },
	});

	return { status: "created" as const, team, user, membership };
}

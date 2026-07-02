import type {
	AuditEventRow,
	TeamMembershipRole,
	TeamMembershipRow,
	TeamRow,
	UserPasswordCredentialRow,
	UserRow,
	UserSessionRow,
	UserStatus,
} from "../db-contract.ts";

type Queryable = {
	query<T = unknown>(
		text: string,
		values?: readonly unknown[],
	): Promise<{ rows: T[] }>;
};

const nowDate = () => new Date();
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export interface AuthRepository {
	countUsers(): Promise<number>;
	findUserById(userId: number): Promise<UserRow | null>;
	findUserByEmail(email: string): Promise<UserRow | null>;
	createTeam(input: { name: string; created_at?: Date }): Promise<TeamRow>;
	createUser(input: {
		email: string;
		display_name?: string | null;
		status?: UserStatus;
		created_at?: Date;
	}): Promise<UserRow>;
	addTeamMembership(input: {
		team_id: number;
		user_id: number;
		role: TeamMembershipRole;
		created_at?: Date;
	}): Promise<TeamMembershipRow>;
	listTeamMembershipsByUserId(userId: number): Promise<TeamMembershipRow[]>;
	upsertPasswordCredential(input: {
		user_id: number;
		password_hash: string;
		updated_at?: Date;
	}): Promise<UserPasswordCredentialRow>;
	getPasswordCredentialByUserId(
		userId: number,
	): Promise<UserPasswordCredentialRow | null>;
	createSession(input: {
		user_id: number;
		session_token_hash: string;
		expires_at: Date;
		created_at?: Date;
	}): Promise<UserSessionRow>;
	getSessionByTokenHash(tokenHash: string): Promise<UserSessionRow | null>;
	revokeSessionByTokenHash(
		tokenHash: string,
		revokedAt?: Date,
	): Promise<UserSessionRow | null>;
	recordAuditEvent(input: {
		actor_user_id?: number | null;
		team_id?: number | null;
		entity_type: string;
		entity_id: string;
		action: string;
		before_json?: Record<string, unknown>;
		after_json?: Record<string, unknown>;
		request_metadata?: Record<string, unknown>;
		created_at?: Date;
	}): Promise<AuditEventRow>;
	listAuditEvents?(): Promise<AuditEventRow[]>;
}

export function createPostgresAuthRepository(db: Queryable): AuthRepository {
	return {
		async countUsers() {
			const result = await db.query<{ count: number | string }>(
				"SELECT COUNT(*)::int AS count FROM users",
			);
			return Number(result.rows[0]?.count ?? 0);
		},
		async findUserByEmail(email) {
			const result = await db.query<UserRow>(
				"SELECT * FROM users WHERE email = $1 LIMIT 1",
				[normalizeEmail(email)],
			);
			return result.rows[0] ?? null;
		},
		async findUserById(userId) {
			const result = await db.query<UserRow>(
				"SELECT * FROM users WHERE id = $1 LIMIT 1",
				[userId],
			);
			return result.rows[0] ?? null;
		},
		async createTeam(input) {
			const result = await db.query<TeamRow>(
				"INSERT INTO teams (name, created_at) VALUES ($1, $2) RETURNING *",
				[input.name, input.created_at ?? nowDate()],
			);
			return result.rows[0];
		},
		async createUser(input) {
			const timestamp = input.created_at ?? nowDate();
			const result = await db.query<UserRow>(
				`INSERT INTO users (email, display_name, status, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $4)
				 RETURNING *`,
				[
					normalizeEmail(input.email),
					input.display_name ?? null,
					input.status ?? "active",
					timestamp,
				],
			);
			return result.rows[0];
		},
		async addTeamMembership(input) {
			const result = await db.query<TeamMembershipRow>(
				`INSERT INTO team_memberships (team_id, user_id, role, created_at)
				 VALUES ($1, $2, $3, $4)
				 RETURNING *`,
				[input.team_id, input.user_id, input.role, input.created_at ?? nowDate()],
			);
			return result.rows[0];
		},
		async listTeamMembershipsByUserId(userId) {
			const result = await db.query<TeamMembershipRow>(
				"SELECT * FROM team_memberships WHERE user_id = $1 ORDER BY id ASC",
				[userId],
			);
			return result.rows;
		},
		async upsertPasswordCredential(input) {
			const at = input.updated_at ?? nowDate();
			const result = await db.query<UserPasswordCredentialRow>(
				`INSERT INTO user_password_credentials (user_id, password_hash, created_at, updated_at)
				 VALUES ($1, $2, $3, $3)
				 ON CONFLICT (user_id) DO UPDATE
				 SET password_hash = EXCLUDED.password_hash,
				     updated_at = EXCLUDED.updated_at
				 RETURNING *`,
				[input.user_id, input.password_hash, at],
			);
			return result.rows[0];
		},
		async getPasswordCredentialByUserId(userId) {
			const result = await db.query<UserPasswordCredentialRow>(
				"SELECT * FROM user_password_credentials WHERE user_id = $1 LIMIT 1",
				[userId],
			);
			return result.rows[0] ?? null;
		},
		async createSession(input) {
			const result = await db.query<UserSessionRow>(
				`INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at)
				 VALUES ($1, $2, $3, $4)
				 RETURNING *`,
				[
					input.user_id,
					input.session_token_hash,
					input.expires_at,
					input.created_at ?? nowDate(),
				],
			);
			return result.rows[0];
		},
		async getSessionByTokenHash(tokenHash) {
			const result = await db.query<UserSessionRow>(
				"SELECT * FROM user_sessions WHERE session_token_hash = $1 LIMIT 1",
				[tokenHash],
			);
			return result.rows[0] ?? null;
		},
		async revokeSessionByTokenHash(tokenHash, revokedAt = nowDate()) {
			const result = await db.query<UserSessionRow>(
				`UPDATE user_sessions
				 SET revoked_at = $2
				 WHERE session_token_hash = $1 AND revoked_at IS NULL
				 RETURNING *`,
				[tokenHash, revokedAt],
			);
			return result.rows[0] ?? null;
		},
		async recordAuditEvent(input) {
			const result = await db.query<AuditEventRow>(
				`INSERT INTO audit_events (
				 actor_user_id, team_id, entity_type, entity_id, action,
				 before_json, after_json, request_metadata, created_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				RETURNING *`,
				[
					input.actor_user_id ?? null,
					input.team_id ?? null,
					input.entity_type,
					input.entity_id,
					input.action,
					input.before_json ?? {},
					input.after_json ?? {},
					input.request_metadata ?? {},
					input.created_at ?? nowDate(),
				],
			);
			return result.rows[0];
		},
	};
}

export function createInMemoryAuthRepository(): AuthRepository {
	const teams: TeamRow[] = [];
	const users: UserRow[] = [];
	const memberships: TeamMembershipRow[] = [];
	const credentials = new Map<number, UserPasswordCredentialRow>();
	const sessions: UserSessionRow[] = [];
	const audits: AuditEventRow[] = [];
	let nextTeamId = 1;
	let nextUserId = 1;
	let nextMembershipId = 1;
	let nextSessionId = 1;
	let nextAuditId = 1;

	return {
		async countUsers() {
			return users.length;
		},
		async findUserByEmail(email) {
			return users.find((row) => row.email === normalizeEmail(email)) ?? null;
		},
		async findUserById(userId) {
			return users.find((row) => row.id === userId) ?? null;
		},
		async createTeam(input) {
			const row = { id: nextTeamId++, name: input.name, created_at: input.created_at ?? nowDate() };
			teams.push(row);
			return row;
		},
		async createUser(input) {
			const at = input.created_at ?? nowDate();
			const row: UserRow = {
				id: nextUserId++,
				email: normalizeEmail(input.email),
				display_name: input.display_name ?? null,
				status: input.status ?? "active",
				created_at: at,
				updated_at: at,
			};
			users.push(row);
			return row;
		},
		async addTeamMembership(input) {
			const row: TeamMembershipRow = {
				id: nextMembershipId++,
				team_id: input.team_id,
				user_id: input.user_id,
				role: input.role,
				created_at: input.created_at ?? nowDate(),
			};
			memberships.push(row);
			return row;
		},
		async listTeamMembershipsByUserId(userId) {
			return memberships.filter((row) => row.user_id === userId);
		},
		async upsertPasswordCredential(input) {
			const current = credentials.get(input.user_id);
			const at = input.updated_at ?? nowDate();
			const row: UserPasswordCredentialRow = {
				user_id: input.user_id,
				password_hash: input.password_hash,
				created_at: current?.created_at ?? at,
				updated_at: at,
			};
			credentials.set(input.user_id, row);
			return row;
		},
		async getPasswordCredentialByUserId(userId) {
			return credentials.get(userId) ?? null;
		},
		async createSession(input) {
			const row: UserSessionRow = {
				id: nextSessionId++,
				user_id: input.user_id,
				session_token_hash: input.session_token_hash,
				expires_at: input.expires_at,
				revoked_at: null,
				created_at: input.created_at ?? nowDate(),
			};
			sessions.push(row);
			return row;
		},
		async getSessionByTokenHash(tokenHash) {
			return sessions.find((row) => row.session_token_hash === tokenHash) ?? null;
		},
		async revokeSessionByTokenHash(tokenHash, revokedAt = nowDate()) {
			const row = sessions.find((session) => session.session_token_hash === tokenHash);
			if (!row || row.revoked_at) return row ?? null;
			row.revoked_at = revokedAt;
			return row;
		},
		async recordAuditEvent(input) {
			const row: AuditEventRow = {
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? null,
				entity_type: input.entity_type,
				entity_id: input.entity_id,
				action: input.action,
				before_json: input.before_json ?? {},
				after_json: input.after_json ?? {},
				request_metadata: input.request_metadata ?? {},
				created_at: input.created_at ?? nowDate(),
			};
			audits.push(row);
			return row;
		},
		async listAuditEvents() {
			return [...audits];
		},
	};
}

import { ensureSchemaInitialized, pool } from "@/lib/db";
import { createPostgresAuthRepository } from "@/lib/repositories/auth-repository";
import type { SessionRouteDeps } from "./session";

const authDb = {
	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		await ensureSchemaInitialized();
		return pool.query(text, values ? [...values] : undefined) as unknown as Promise<{ rows: T[] }>;
	},
};

export const runtimeSessionDeps: SessionRouteDeps = {
	repo: createPostgresAuthRepository(authDb),
};

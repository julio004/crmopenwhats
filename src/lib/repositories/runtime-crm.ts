import { ensureSchemaInitialized, getActiveWhatsAppInstance, pool } from "@/lib/db";
import { createPostgresCrmRepository } from "./crm-repository";

const crmDb = {
	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		await ensureSchemaInitialized();
		return pool.query(text, values ? [...values] : undefined) as unknown as Promise<{ rows: T[] }>;
	},
	async connect() {
		await ensureSchemaInitialized();
		return pool.connect();
	},
};

export const runtimeCrmRepository = createPostgresCrmRepository(crmDb, {
	getTenantId: async () => (await getActiveWhatsAppInstance()).id,
});

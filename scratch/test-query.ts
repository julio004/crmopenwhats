import "../scripts/env-loader.ts";
import pg from "pg";

async function testQuery() {
	const connectionString = process.env.DATABASE_URL?.replace("db:5432", "localhost:5432") || "postgresql://user:password@localhost:5432/whatsapp_bot";
	const pool = new pg.Pool({ connectionString });

	try {
		// 1. Get settings
		const settingsRes = await pool.query("SELECT * FROM settings");
		const settings: Record<string, any> = {};
		for (const row of settingsRes.rows) {
			settings[row.key] = row.value === "true" ? true : row.value === "false" ? false : isNaN(Number(row.value)) ? row.value : Number(row.value);
		}
		console.log("Settings:", settings);

		const now = new Date();
		const minHoursAfterAssistant = settings.followup_min_hours_after_assistant || 12;
		const maxAttempts = settings.followup_max_attempts || 2;
		const freeformWindowHours = settings.whatsapp_freeform_window_hours || 24;
		const blockOutside24h = settings.block_outside_24h_followups !== false;

		let minAgeMs = minHoursAfterAssistant * 3_600_000;

		// Replicar logica del postgres-adapter.ts
		if (process.env.NODE_ENV !== "production" && process.env.DEV_FOLLOWUP_MIN_AGE_SECONDS) {
			const overrideSec = parseInt(process.env.DEV_FOLLOWUP_MIN_AGE_SECONDS, 10);
			if (!isNaN(overrideSec)) {
				minAgeMs = overrideSec * 1000;
			}
		}
		
		console.log("minAgeMs (ms):", minAgeMs);

		const followUpCutoff = new Date(now.getTime() - minAgeMs);
		const values: unknown[] = [followUpCutoff, maxAttempts];
		let windowPredicate = "TRUE";
		if (blockOutside24h) {
			const freeformCutoff = new Date(now.getTime() - freeformWindowHours * 3_600_000);
			values.push(freeformCutoff);
			windowPredicate = `c.last_user_message_at IS NOT NULL AND c.last_user_message_at >= $3`;
		}

		console.log("Query Values:", values);

		const queryText = `
			SELECT c.*
			FROM conversations c
			JOIN LATERAL (
				SELECT m.role, m.created_at
				FROM messages m
				WHERE m.conversation_id = c.id
				ORDER BY m.created_at DESC
				LIMIT 1
			) latest ON TRUE
			WHERE c.mode = 'AI'
				AND c.followup_attempts < $2
				AND latest.role = 'assistant'
				AND latest.created_at <= $1
				AND NOT EXISTS (
					SELECT 1 FROM messages newer_user
					WHERE newer_user.conversation_id = c.id
						AND newer_user.role = 'user'
						AND newer_user.created_at > latest.created_at
				)
				AND ${windowPredicate}
			ORDER BY latest.created_at ASC
		`;

		const result = await pool.query(queryText, values);
		console.log("\nQuery result rows count:", result.rows.length);
		if (result.rows.length > 0) {
			console.log("Candidates:", JSON.stringify(result.rows, null, 2));
		} else {
			console.log("No candidates found!");
		}

		// Veamos la ultima fecha de conversacion 2 contra cutoff
		const conv2 = await pool.query("SELECT * FROM conversations WHERE id = 2");
		if (conv2.rows.length > 0) {
			const c = conv2.rows[0];
			console.log("\nDetails of Conv 2:");
			console.log("- mode:", c.mode);
			console.log("- followup_attempts:", c.followup_attempts);
			
			const latestMsg = await pool.query("SELECT role, created_at FROM messages WHERE conversation_id = 2 ORDER BY created_at DESC LIMIT 1");
			if (latestMsg.rows.length > 0) {
				const lm = latestMsg.rows[0];
				console.log("- latest message role:", lm.role);
				console.log("- latest message created_at:", lm.created_at);
				console.log("- cutoff date:", followUpCutoff);
				console.log("- is latest message <= cutoff?:", new Date(lm.created_at) <= followUpCutoff);
			}
		}

	} catch (error) {
		console.error("Query failed:", error);
	} finally {
		await pool.end();
	}
}

testQuery();

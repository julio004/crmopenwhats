import "../scripts/env-loader.ts";
import { pool } from "../src/lib/db.ts";

async function main() {
	const resConvos = await pool.query("SELECT * FROM conversations");
	console.log("CONVERSATIONS IN DB:");
	console.log(resConvos.rows);

	const resMessages = await pool.query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 5");
	console.log("LAST 5 MESSAGES:");
	console.log(resMessages.rows);
	
	const resSettings = await pool.query("SELECT * FROM settings");
	console.log("SETTINGS:");
	console.log(resSettings.rows);

	await pool.end();
}

main().catch(console.error);

import pg from "pg";

const pool = new pg.Pool({
	connectionString: "postgresql://user:password@localhost:5432/whatsapp_bot",
});

async function main() {
	try {
		console.log("Conectando...");
		const settings = await pool.query("SELECT * FROM settings");
		console.log("Configuración en base de datos:");
		for (const row of settings.rows) {
			console.log(`- ${row.key}: ${JSON.stringify(row.value)}`);
		}
		const conv = await pool.query("SELECT * FROM conversations WHERE id = 2");
		console.log("\nConversación 2:");
		console.log(JSON.stringify(conv.rows[0], null, 2));
	} catch (error) {
		console.error("Error:", error);
	} finally {
		await pool.end();
	}
}

main();

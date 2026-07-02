import pg from "pg";

const pool = new pg.Pool({
	connectionString: "postgresql://user:password@localhost:5432/whatsapp_bot",
});

async function main() {
	try {
		console.log("Conectando a la base de datos...");
		const conversations = await pool.query("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 5");
		console.log(`Encontradas ${conversations.rows.length} conversaciones recientes.`);
		for (const conv of conversations.rows) {
			console.log(`\n--- Conversación ID: ${conv.id}, Teléfono: ${conv.phone}, Modo: ${conv.mode} ---`);
			const messages = await pool.query(
				"SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
				[conv.id]
			);
			console.log(`Mensajes (${messages.rows.length}):`);
			for (const msg of messages.rows) {
				console.log(`[${msg.created_at.toISOString()}] [${msg.direction}] [${msg.role}] [source: ${msg.source}]: ${msg.content}`);
			}
			const events = await pool.query(
				"SELECT * FROM conversation_events WHERE conversation_id = $1 ORDER BY created_at ASC",
				[conv.id]
			);
			console.log(`Eventos (${events.rows.length}):`);
			for (const ev of events.rows) {
				console.log(`[${ev.created_at.toISOString()}] [${ev.event_type}] [actor: ${ev.actor_role}] reason: ${ev.reason}, metadata: ${JSON.stringify(ev.metadata)}`);
			}
		}
	} catch (error) {
		console.error("Error:", error);
	} finally {
		await pool.end();
	}
}

main();

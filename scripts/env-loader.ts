import path from "node:path";
import fs from "node:fs";

function loadEnvFile(filename: string) {
	const envPath = path.resolve(process.cwd(), filename);
	if (fs.existsSync(envPath)) {
		const text = fs.readFileSync(envPath, "utf-8");
		for (const rawLine of text.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith("#")) continue;
			const eq = line.indexOf("=");
			if (eq < 0) continue;
			const key = line.slice(0, eq).trim();
			let value = line.slice(eq + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			if (!(key in process.env)) {
				process.env[key] = value;
			}
		}
	}
}

// Cargar primero .env.local si existe (mayor prioridad) y luego .env
loadEnvFile(".env.local");
loadEnvFile(".env");

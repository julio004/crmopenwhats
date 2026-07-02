import fs from "fs";
import path from "path";
import { saveSystemPrompt } from "../src/lib/db.ts";

async function main() {
	try {
		const jsonPath = path.join(process.cwd(), "concepto.json");
		if (!fs.existsSync(jsonPath)) {
			console.error("[script] No se encontró el archivo concepto.json");
			process.exit(1);
		}

		const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
		// Buscamos el nodo del sistema de restaurante
		const node = data.nodes?.find((n: any) => n.id === "4267a398-a5e4-4996-b09f-f5de6abd35c3");
		if (!node || !node.parameters?.options?.systemMessage) {
			console.error("[script] No se encontró el nodo o el systemMessage del Restaurante en concepto.json");
			process.exit(1);
		}

		const promptContent = node.parameters.options.systemMessage;
		const saved = await saveSystemPrompt("Asesor de Ventas - Sistema de Restaurante Azokia", promptContent);
		console.log(`[script] ¡Prompt de Restaurante guardado con éxito! ID: ${saved.id}, Título: ${saved.title}`);
		process.exit(0);
	} catch (error) {
		console.error("[script] Error guardando prompt:", error);
		process.exit(1);
	}
}

main();

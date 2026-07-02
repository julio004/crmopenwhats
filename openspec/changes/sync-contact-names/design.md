# Design: Sincronizar nombres de contactos desde la libreta de direcciones de WhatsApp

## 1. Modificaciones en la Capa de Datos (`src/lib/db.ts`)

Añadir la función `updateConversationNameIfExists` al final del archivo:
```typescript
// En src/lib/db.ts:
export async function updateConversationNameIfExists(jid: string, name: string): Promise<void> {
	await ensureSchemaInitialized();
	const phone = jid.replace(/@.*/, "");
	
	// Filtro preventivo contra el nombre de perfil del dueño
	const normalized = name.trim();
	if (normalized === "Azokia" || normalized === "Azokiallc" || normalized === "") return;

	await pool.query(
		`UPDATE conversations
		 SET name = $1, updated_at = NOW()
		 WHERE (phone = $2 OR jid = $3)
		   AND (name IS NULL OR TRIM(name) = '' OR (name <> $1 AND name <> 'Azokia' AND name <> 'Azokiallc'))`,
		[normalized, phone, jid]
	);
}
```

## 2. Modificaciones en el Cliente de WhatsApp (`src/lib/baileys/client.ts`)

Importar la nueva función y registrar los manejadores de eventos en `startWASocket()`:
```typescript
// En las importaciones de src/lib/baileys/client.ts:
import {
	...
	updateConversation,
	updateConversationNameIfExists, // Añadir esta importación
	setMode,
	...
} from "../db.ts";

// Dentro de startWASocket(), al final del registro de eventos:
	sock.ev.on("contacts.upsert", async (contacts: any[]) => {
		for (const contact of contacts) {
			if (contact.id && !contact.id.endsWith("@g.us")) {
				const name = contact.name?.trim() || contact.notify?.trim() || contact.verifiedName?.trim();
				if (name) {
					try {
						await updateConversationNameIfExists(contact.id, name);
					} catch (err) {
						console.error("[bot-error] Falló al procesar contacts.upsert para el JID " + contact.id + ":", err);
					}
				}
			}
		}
	});

	sock.ev.on("contacts.update", async (contacts: any[]) => {
		for (const contact of contacts) {
			if (contact.id && !contact.id.endsWith("@g.us")) {
				const name = contact.name?.trim() || contact.notify?.trim() || contact.verifiedName?.trim();
				if (name) {
					try {
						await updateConversationNameIfExists(contact.id, name);
					} catch (err) {
						console.error("[bot-error] Falló al procesar contacts.update para el JID " + contact.id + ":", err);
					}
				}
			}
		}
	});
```
Este diseño previene la sobreescritura con "Azokia" o vacíos y no introduce sobrecarga por creación innecesaria de filas de contactos inactivos.

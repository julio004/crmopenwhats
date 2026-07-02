# Design: Sincronización Completa de Contactos al Conectar (Estilo Evolution API)

## 1. Modificaciones en la Capa de Datos (`src/lib/db.ts`)

```typescript
// En src/lib/db.ts:
export async function listConversations(options: { archived?: boolean; hasMessages?: boolean } = {}): Promise<ConversationListRow[]> {
	await ensureSchemaInitialized();
	const isArchived = options.archived === true;
	
	let sql = `SELECT c.*, 
		        m.content AS last_message_content, 
		        m.role AS last_message_role
		 FROM conversations c
		 LEFT JOIN connection_state cs ON cs.id = 1
		 LEFT JOIN LATERAL (
		   SELECT content, role
		   FROM messages
		   WHERE conversation_id = c.id
		   ORDER BY created_at DESC
		   LIMIT 1
		 ) m ON TRUE
		 WHERE (c.phone <> cs.phone OR cs.phone IS NULL) AND c.is_archived = $1`;
		 
	if (options.hasMessages === true) {
		sql += ` AND (c.last_message_at IS NOT NULL OR c.unread_count > 0)`;
	}
	
	sql += ` ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC`;

	const res = await pool.query<ConversationListRow>(sql, [isArchived]);
	return res.rows;
}
```

## 2. Modificaciones en el Endpoint (`src/app/api/conversations/route.ts`)

```typescript
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const archived = searchParams.get("archived") === "true";
		const hasMessages = searchParams.get("hasMessages") === "true";
		const conversations = await listConversations({ archived, hasMessages });
		return NextResponse.json(conversations);
	} catch (error: any) { ... }
}
```

## 3. Modificaciones en el Cliente Baileys (`src/lib/baileys/client.ts`)

Cambiar los listeners de contactos para que inserten utilizando `getOrCreateConversation`:
```typescript
	sock.ev.on("contacts.upsert", async (contacts: any[]) => {
		for (const contact of contacts) {
			if (contact.id && !contact.id.endsWith("@g.us")) {
				const name = contact.name?.trim() || contact.notify?.trim() || contact.verifiedName?.trim();
				if (name) {
					try {
						const phone = contact.id.replace(/@.*/, "");
						await getOrCreateConversation(phone, contact.id, name);
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
						const phone = contact.id.replace(/@.*/, "");
						await getOrCreateConversation(phone, contact.id, name);
					} catch (err) {
						console.error("[bot-error] Falló al procesar contacts.update para el JID " + contact.id + ":", err);
					}
				}
			}
		}
	});
```

## 4. Modificaciones en el Frontend (`src/app/page.tsx`)

Integrar la separación entre Chats Activos y Contactos CRM en `page.tsx`:
```typescript
// Declarar estados y loader:
const [contactsList, setContactsList] = useState<ConversationListRow[]>([]);
const [loadingContacts, setLoadingContacts] = useState(false);

const loadAllContacts = async () => {
	setLoadingContacts(true);
	try {
		const res = await fetch(`/api/conversations?archived=false`);
		if (res.ok) {
			const data = await res.json();
			setContactsList(data);
		}
	} catch (error) {
		console.error("[home] Error cargando contactos crm:", error);
	} finally {
		setLoadingContacts(false);
	}
};

useEffect(() => {
	if (activeTab === "contacts") {
		loadAllContacts();
	}
}, [activeTab]);

// Modificar loadConversations para pedir solo chats activos:
const loadConversations = async (archived = showArchived) => {
	try {
		// Pasamos hasMessages=true para la lista de chats activos lateral
		const res = await fetch(`/api/conversations?archived=${archived}&hasMessages=true`);
		if (res.ok) {
			const data = await res.json();
			setConversations(data);
		}
	} catch (error) { ... }
};

// Pasar contactsList a ContactsOverview:
{activeTab === "contacts" && (
	<ContactsOverview conversations={contactsList} />
)}
```

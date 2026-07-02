# Design: Archivar Chats para ocultarlos de la pantalla principal

## 1. Modificaciones en Base de Datos

### 1.1 `src/lib/db-contract.ts`
Actualizar la definición SQL y la interfaz del contrato:
```typescript
// En DATABASE_SCHEMA_SQL (L42):
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY, phone TEXT UNIQUE NOT NULL, jid TEXT UNIQUE, name TEXT,
  profile_picture_url TEXT, profile_picture_fetched_at TIMESTAMP WITH TIME ZONE,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI', mode_reason TEXT,
  mode_changed_at TIMESTAMP WITH TIME ZONE, mode_changed_by TEXT CHECK(mode_changed_by IN ('system','owner','dashboard','assistant')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE, -- Nueva columna
  ...
);

// En la interfaz ConversationRow:
export interface ConversationRow {
	...
	unread_count: number;
	is_archived: boolean; // Nuevo campo
	created_at: Date;
	updated_at: Date;
}

// En createInMemoryRepository (L226):
const row: ConversationRow = {
	...
	unread_count: 0,
	is_archived: false, // Por defecto falso
	created_at: created,
	updated_at: created,
};
```

### 1.2 `src/lib/postgres-adapter.ts`
Añadir la migración incremental y habilitar la columna para el PATCH:
```typescript
// En initializePostgresSchema (L38):
export async function initializePostgresSchema(pool: PostgresQueryable) {
	await pool.query(
		`${DATABASE_SCHEMA_SQL}
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_picture_fetched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;` // Nueva migración
	);
}

// En UPDATE_CONVERSATION_COLUMNS (L51):
const UPDATE_CONVERSATION_COLUMNS = new Set([
	"name",
	...
	"unread_count",
	"is_archived", // Añadido
	"profile_picture_url",
	...
]);
```

### 1.3 `src/lib/db.ts`
Filtrar chats archivados en el listado principal:
```typescript
// En listConversations() (L157):
export async function listConversations(): Promise<ConversationListRow[]> {
	await ensureSchemaInitialized();
	const res = await pool.query<ConversationListRow>(
		`SELECT c.*, 
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
		 WHERE (c.phone <> cs.phone OR cs.phone IS NULL)
		   AND c.is_archived = FALSE -- Filtrar archivados
		 ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC`
	);
	return res.rows;
}
```

## 2. Modificaciones en API backend
Actualizar el endpoint `PATCH` en `src/app/api/conversations/[conversationId]/route.ts`:
```typescript
export async function PATCH(req: Request, { params }: Ctx) {
	try {
		const { conversationId } = await params;
		const parsedId = Number.parseInt(conversationId, 10);
		if (Number.isNaN(parsedId)) {
			return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
		}
		const body = await req.json().catch(() => ({}));
		const patch: any = {};
		
		if (typeof body.name === "string") {
			const rawName = body.name.trim();
			patch.name = rawName.length > 0 ? rawName.slice(0, 120) : null;
		}
		if (typeof body.is_archived === "boolean") {
			patch.is_archived = body.is_archived;
		}

		const existing = await getConversationById(parsedId);
		if (!existing) {
			return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
		}

		const updated = await updateConversation(parsedId, patch);
		return NextResponse.json(updated);
	} catch (error: any) {
		console.error("[api] Error en PATCH /api/conversations/[conversationId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}
```

## 3. Modificaciones en Frontend (UI)

### 3.1 `src/components/Icons.tsx`
Añadir el componente `ArchiveIcon`:
```typescript
export const ArchiveIcon = ({ className = "text-current", size = 16, ...props }: IconProps) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		{...props}
	>
		<rect width="20" height="5" x="2" y="3" rx="1" />
		<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
		<line x1="10" x2="14" y1="12" y2="12" />
	</svg>
);
```

### 3.2 `src/components/ConversationPanel.tsx`
Importar el nuevo icono y agregar el botón de archivado junto a la lógica de petición de red:
```typescript
// Importar ArchiveIcon de Icons:
import { TrashIcon, MessagesIcon, RobotIcon, ArrowRightIcon, ArrowDownIcon, UserIcon, PhoneIcon, EditIcon, ArchiveIcon } from "./Icons.tsx";

// Agregar estado para archivado:
const [archiving, setArchiving] = useState(false);

// Implementar handler handleArchive:
const handleArchive = async () => {
	if (archiving) return;
	setArchiving(true);
	try {
		const res = await fetch(`/api/conversations/${conversation.id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ is_archived: true }),
		});
		if (res.ok) {
			onDeleted(); // Des-selecciona y recarga la lista
		} else {
			console.error("[archive] Error archivando conversación.");
		}
	} catch (error) {
		console.error("[archive] Error de red archivando conversación:", error);
	} finally {
		setArchiving(false);
	}
};

// Renderizar el botón en la cabecera antes del de Borrar:
<button
	onClick={handleArchive}
	disabled={archiving}
	className="px-3 py-1.5 text-primary hover:bg-primary/10 border border-primary rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
	title="Archivar conversación para no verla al frente"
>
	<ArchiveIcon size={12} /> Archivar
</button>
```

# Design: Visualizar y Desarchivar Chats

## 1. Modificaciones en la Capa de Datos (`src/lib/db.ts`)

```typescript
// Actualizar la firma y el query de listConversations:
export async function listConversations(options: { archived?: boolean } = {}): Promise<ConversationListRow[]> {
	await ensureSchemaInitialized();
	const isArchived = options.archived === true;
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
		 WHERE (c.phone <> cs.phone OR cs.phone IS NULL) AND c.is_archived = $1
		 ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC`,
		[isArchived]
	);
	return res.rows;
}
```

## 2. Modificaciones en la API (`src/app/api/conversations/route.ts`)

```typescript
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const archived = searchParams.get("archived") === "true";
		const conversations = await listConversations({ archived });
		return NextResponse.json(conversations);
	} catch (error: any) {
		console.error("[api] Error en GET /api/conversations:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}
```

## 3. Modificaciones en la UI

### 3.1 `src/components/ConversationList.tsx`
Actualizar props y renderizar botón de alternancia en la cabecera:
```typescript
interface ConversationListProps {
	conversations: ConversationListRow[];
	selectedId: number | null;
	onSelectConversation: (id: number) => void;
	showArchived: boolean;
	onToggleArchived: (val: boolean) => void;
}

// En el render de la cabecera (L70):
<div className="p-4 flex items-center justify-between shrink-0">
	<h2 className="font-display text-sm font-bold text-on-surface uppercase tracking-wider">
		{showArchived ? "Chats Archivados" : "Chats Activos"}
	</h2>
	<div className="flex items-center gap-2">
		<button
			onClick={() => onToggleArchived(!showArchived)}
			className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
		>
			{showArchived ? "Ver Activos" : "Ver Archivados"}
		</button>
		<span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
			{filteredConversations.length}
		</span>
	</div>
</div>
```

### 3.2 `src/app/page.tsx`
Integrar el estado y callback a `ConversationList`:
```typescript
const [showArchived, setShowArchived] = useState(false);

const loadConversations = async (archived = showArchived) => {
	try {
		const res = await fetch(`/api/conversations?archived=${archived}`);
		if (res.ok) {
			const data = await res.json();
			setConversations(data);
		}
	} catch (error) {
		console.error("[app] Error cargando conversaciones:", error);
	}
};

useEffect(() => {
	loadConversations(showArchived);
}, [showArchived]);

// En el render de ConversationList (L301):
<ConversationList
	conversations={sortedConversations}
	selectedId={selectedId}
	onSelectConversation={setSelectedId}
	showArchived={showArchived}
	onToggleArchived={(val) => {
		setSelectedId(null); // Limpiar selección activa al cambiar de vista
		setShowArchived(val);
	}}
/>
```

### 3.3 `src/components/ConversationPanel.tsx`
Soportar el desarchivado según `conversation.is_archived`:
```typescript
const handleArchive = async () => {
	if (archiving) return;
	setArchiving(true);
	const nextState = !conversation.is_archived;
	try {
		const res = await fetch(`/api/conversations/${conversation.id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ is_archived: nextState }),
		});
		if (res.ok) {
			onDeleted();
		} else {
			console.error("[archive] Error actualizando estado de archivado.");
		}
	} catch (error) {
		console.error("[archive] Error de red:", error);
	} finally {
		setArchiving(false);
	}
};

// En el render (L278):
<button
	onClick={handleArchive}
	disabled={archiving}
	className="px-3 py-1.5 text-primary hover:bg-primary/10 border border-primary rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
	title={conversation.is_archived ? "Desarchivar conversación" : "Archivar conversación"}
>
	<ArchiveIcon size={12} /> {conversation.is_archived ? "Desarchivar" : "Archivar"}
</button>
```

# Design: CRM Gaps Resolution

## 1. Transacciones en Postgres y Conectores de Pool

### 1.1 `src/lib/repositories/runtime-crm.ts`
Agregaremos el método `connect` al wrapper `crmDb` para permitir obtener un cliente individual con conexión dedicada del pool. Esto garantiza que las transacciones `BEGIN`/`COMMIT`/`ROLLBACK` corran en la misma conexión.

```typescript
const crmDb = {
	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		await ensureSchemaInitialized();
		return pool.query(text, values ? [...values] : undefined) as unknown as Promise<{ rows: T[] }>;
	},
	async connect() {
		await ensureSchemaInitialized();
		return pool.connect();
	}
};
```

### 1.2 `src/lib/repositories/crm-repository.ts`
Implementaremos transaccionalidad robusta en Postgres usando el cliente de base de datos.
Definiremos un helper para verificar si la base de datos es un pool y soporta `connect`:

```typescript
const hasConnect = (db: any): db is { connect: () => Promise<any> } => {
	return db && typeof db.connect === "function";
};
```

En `reassignContactOwner`:
1.  Verificar si el contacto existe y si el `owner_user_id` ya es el nuevo (no-op). Si es así, retornar el contacto directamente.
2.  Hacer checkout del cliente si `hasConnect(db)` es true.
3.  Iniciar la transacción con `BEGIN`.
4.  Actualizar el propietario del contacto y registrar el evento en `audit_events`.
5.  Hacer `COMMIT`. Si algo falla, hacer `ROLLBACK` y re-lanzar el error. Liberar el cliente en un bloque `finally`.

En `setConversationCrmLink`:
1.  Verificar si el link ya existe con los mismos valores (no-op). Si es así, retornar el link directamente.
2.  Iniciar transacción con `BEGIN`.
3.  Insertar/actualizar el link y registrar la auditoría.
4.  Hacer `COMMIT` / `ROLLBACK` y liberar el cliente de manera análoga.

## 2. Invariantes del Mock en Memoria

En `InMemoryCrmRepository.setConversationCrmLink` validaremos:
1.  **CHECK constraint:** Lanzar error si tanto `input.contact_id` como `input.account_id` son nulos.
2.  **Foreign Key contact_id:** Si `input.contact_id` es provisto y no nulo, validar que exista en el array de `contacts`. Si no, lanzar error.
3.  **Foreign Key account_id:** Si `input.account_id` es provisto y no nulo, validar que exista en el array de `accounts`. Si no, lanzar error.

También implementaremos cortocircuitos no-op en los métodos en memoria para que no generen logs de auditoría duplicados o vacíos si no hay cambios.

## 3. Integridad de los Nombres de Conversación

En `src/lib/services/conversation-view.ts`:
Crearemos una función helper para determinar si un nombre es por defecto (igual al teléfono o nulo/vacío).

```typescript
function isDefaultName(name: string | null | undefined, phone: string | null | undefined): boolean {
	if (!name) return true;
	const cleanName = name.replace(/\+/g, "").trim();
	const cleanPhone = phone?.replace(/\+/g, "").trim();
	return cleanName === cleanPhone;
}
```

En `enrichConversation`, preservaremos el nombre de la conversación si no es un nombre por defecto:
```typescript
const hasFriendlyName = conversation.name && !isDefaultName(conversation.name, conversation.phone);
const finalName = hasFriendlyName ? conversation.name : (identity?.contact_name ?? conversation.name);

return {
	...conversation,
	// ... otros campos enriquecidos ...
	name: finalName,
};
```
Actualizaremos las pruebas correspondientes en `tests/conversation-view.test.ts` para que utilicen conversaciones con nombre nulo/teléfono cuando esperen que se sobrescriba por el nombre del contacto de CRM.

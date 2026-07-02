# Specification: Archivar Chats para ocultarlos de la pantalla principal

## 1. Comportamiento en la Base de Datos

### 1.1 Esquema
- Se debe añadir la columna `is_archived` de tipo `BOOLEAN NOT NULL DEFAULT FALSE` en la tabla `conversations`.
- La interfaz `ConversationRow` en `src/lib/db-contract.ts` debe reflejar la propiedad `is_archived: boolean`.
- Al insertar o crear una conversación por defecto (tanto en PostgreSQL como en el repositorio in-memory), `is_archived` debe ser `false`.

### 1.2 Migración
- Al inicializar el adaptador de PostgreSQL en `src/lib/postgres-adapter.ts`, se debe correr una sentencia `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;`.

### 1.3 Listado de Conversaciones
- La función `listConversations()` en `src/lib/db.ts` debe retornar únicamente aquellas conversaciones donde `is_archived = FALSE`.

## 2. API de Modificación
- El controlador `PATCH` en `src/app/api/conversations/[conversationId]/route.ts` debe:
  1. Extraer opcionalmente `is_archived` del body del JSON recibido.
  2. Si es de tipo `boolean`, incluirlo en el objeto de actualización que se pasa a `updateConversation()`.

## 3. Comportamiento en la Interfaz de Usuario

### 3.1 Botón de Archivar
- Se agregará un nuevo botón al panel lateral de la conversación (`ConversationPanel.tsx`) que use el icono `ArchiveIcon`.
- Al clickear el botón "Archivar", se enviará una petición `PATCH` a `/api/conversations/[conversationId]` con `{ is_archived: true }`.
- Si la respuesta es exitosa (código 200), se llamará a la callback `onDeleted` (que limpia la conversación seleccionada y recarga la lista de chats).

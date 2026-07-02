# Specification: Visualizar y Desarchivar Chats

## 1. Backend y Capa de Datos

### 1.1 `listConversations`
- Acepta opcionalmente `options: { archived?: boolean }`.
- Si `options.archived` es `true`, la consulta filtra `AND c.is_archived = TRUE`.
- Si es `false` o no se provee, filtra `AND c.is_archived = FALSE`.

### 1.2 Endpoint `GET /api/conversations`
- Parsea `searchParams.get("archived") === "true"` del request URL.
- Retorna la lista filtrada correspondiente.

## 2. Frontend y UX

### 2.1 Control de Vista en `ConversationList`
- La interfaz del sidebar debe tener un botón en la cabecera con el texto:
  - `"Ver archivados"` (cuando se visualizan los chats activos).
  - `"Ver activos"` (cuando se visualizan los chats archivados).
- Al hacer click, cambia la query y recarga la lista de chats.

### 2.2 Desarchivado en `ConversationPanel`
- Si la conversación cargada tiene `is_archived` en `true`:
  - Se muestra el botón "Desarchivar" en la cabecera (en vez de "Archivar").
  - El handler realiza `PATCH /api/conversations/[id]` con `{ is_archived: false }`.
  - Recarga la lista de chats al completar.

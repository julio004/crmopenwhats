# Proposal: Archivar Chats para ocultarlos de la pantalla principal

## Goal
Permitir archivar chats (conversaciones) para que dejen de mostrarse en la pantalla o bandeja principal, sin eliminarlos físicamente de la base de datos (PostgreSQL/in-memory).

## Analysis
- **Base de datos (Esquema y Adaptador)**:
  - Añadir la columna `is_archived BOOLEAN NOT NULL DEFAULT FALSE` en la definición SQL de la tabla `conversations` dentro de [db-contract.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db-contract.ts).
  - Incluir `is_archived: boolean;` en la interfaz `ConversationRow` y asignarle `false` por defecto en la inicialización in-memory para no romper tests.
  - En [postgres-adapter.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/postgres-adapter.ts), añadir una migración automática (`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;`) en `initializePostgresSchema()`.
  - Añadir `"is_archived"` en la lista blanca de columnas actualizables (`UPDATE_CONVERSATION_COLUMNS`).
  - En [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts), actualizar el query de `listConversations()` para filtrar `AND c.is_archived = FALSE`.

- **Ruta de API (Backend)**:
  - En [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/[conversationId]/route.ts), actualizar el endpoint `PATCH` para permitir recibir `{ is_archived: boolean }` en el cuerpo del JSON y delegarlo a `updateConversation()`.

- **Componentes de Interfaz de Usuario (Frontend)**:
  - Agregar un icono de archivador en [Icons.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/Icons.tsx) (por ejemplo, `ArchiveIcon`).
  - En [ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx), agregar un botón "Archivar" al lado de "Borrar". Al hacer click, enviar `PATCH /api/conversations/[conversationId]` con `{ is_archived: true }` y llamar a `onDeleted()` para des-seleccionar el chat y refrescar la lista.

## Affected Files
- [src/lib/db-contract.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db-contract.ts)
- [src/lib/postgres-adapter.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/postgres-adapter.ts)
- [src/lib/db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts)
- [src/app/api/conversations/[conversationId]/route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/[conversationId]/route.ts)
- [src/components/Icons.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/Icons.tsx)
- [src/components/ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx)

## Next Phase
- Avanzar a **Specs** para detallar las especificaciones y pruebas de validación.

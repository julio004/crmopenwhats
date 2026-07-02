# Archive: Archivar Chats para ocultarlos de la pantalla principal

## Completed Changes

1. **Database Schema & Adapters**:
   - Added `is_archived` column (`BOOLEAN NOT NULL DEFAULT FALSE`) to `conversations` table inside [db-contract.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db-contract.ts) SQL schema and mock repository.
   - Updated `ConversationRow` interface with `is_archived: boolean`.
   - Implemented database migrations and added `is_archived` to `UPDATE_CONVERSATION_COLUMNS` whitelist in [postgres-adapter.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/postgres-adapter.ts).
   - Filtered out archived conversations (`AND c.is_archived = FALSE`) in `listConversations()` inside [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts).

2. **Backend API**:
   - Supported updating `is_archived` property in conversation PATCH route inside [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/[conversationId]/route.ts).

3. **Frontend UI**:
   - Added `ArchiveIcon` inside [Icons.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/Icons.tsx).
   - Implemented "Archivar" action button and its loading state in [ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx). Clicking it triggers the PATCH API and refreshes the panel & sidebar.

## Verification
- Modified test mock definition in [postgres-adapter.test.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/tests/postgres-adapter.test.ts) to resolve typechecker warnings.
- Workspace fully typechecked successfully via `npx tsc --noEmit`.
- Next.js production bundle compiled successfully via `npm run build`.
- Entire test suite executed successfully with all 76 tests passing.

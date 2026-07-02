# Archive: Visualizar y Desarchivar Chats

## Completed Changes

1. **Backend & Database Options (`src/lib/db.ts` & `src/app/api/conversations/route.ts`)**:
   - Modified `listConversations(options?: { archived?: boolean })` to bind query parameter value to `$1` inside SQL query to fetch either active (`is_archived = FALSE`) or archived (`is_archived = TRUE`) conversations.
   - Updated GET route to read `archived` search parameter and call the updated DB query method.

2. **Frontend UI Toggle (`src/components/ConversationList.tsx` & `src/app/page.tsx`)**:
   - Declared `showArchived` state and polling logic dependency in `page.tsx`.
   - Wired up callback triggers inside `ConversationList` header, rendering a toggle button: `"Ver Archivados"` when viewing active chats, and `"Ver Activos"` when viewing archived chats.

3. **Unarchive Action (`src/components/ConversationPanel.tsx`)**:
   - Toggled `is_archived` status by sending `!conversation.is_archived` payload via PATCH request.
   - Handled button state rendering dynamically to show either `"Archivar"` or `"Desarchivar"` with the correct tooltips.

## Verification
- Next.js Turbopack build executed successfully.
- Typechecker verified success via `npx tsc --noEmit`.
- Run complete test suite and all 76 tests passed.

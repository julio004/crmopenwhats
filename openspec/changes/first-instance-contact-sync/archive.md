# Archive: Sincronización Completa de Contactos al Conectar (Estilo Evolution API)

## Completed Changes

1. **Active Chats Sidebar Filter (`src/lib/db.ts` & `src/app/api/conversations/route.ts`)**:
   - Added `hasMessages?: boolean` parameter to `listConversations()`. If `true`, it filters the queries to return only chats that have at least one message.
   - Updated GET API route to parse the `hasMessages` query string and pass it to the data retrieval method.

2. **First-Instance Proactive Contacts Sync (`src/lib/baileys/client.ts`)**:
   - Modified `contacts.upsert` and `contacts.update` event listeners inside the Baileys socket client to call `getOrCreateConversation()` instead of `updateConversationNameIfExists()`.
   - This ensures all WhatsApp address book contacts are saved proactively in the database as soon as the QR is scanned or connection starts.
   - Maintained safeguards preventing writing the owner's WhatsApp profile name ("Azokia").

3. **Frontend Separation (`src/app/page.tsx`)**:
   - Updated sidebar loading query to request `/api/conversations?archived=false&hasMessages=true`, keeping the active chat sidebar completely free of blank contacts.
   - Set up an independent hook to fetch all synchronized contacts (`/api/conversations?archived=false`) and load them into a separate state `contactsList` when the user enters the "Contactos" CRM tab.

## Verification
- Project compiles successfully.
- Typechecker verified success via `npx tsc --noEmit`.
- Run complete test suite and all 76 tests passed.

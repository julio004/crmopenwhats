# Proposal: Profile Modal & Quick Replies (/)

## Goal
Implement a profile modal button next to the "Desconectar" button in the dashboard header. This modal will display the WhatsApp bot's profile information (photo, number, bio/status, and business info if available) and allow managing a list of quick replies. In the chat input, typing `/` will display a dropdown to select and auto-complete these quick replies.

## Architecture & Data Flow
1. **Database Persistence**:
   - The WhatsApp connection client (`client.ts`) already populates `settings` with the key `"bot_profile"`.
   - We will store the custom quick replies in the `settings` table under the key `"quick_replies"` as a JSON array: `Array<{ shortcut: string; text: string }>` (e.g. `[{ "shortcut": "hola", "text": "Hola, ¿en qué te puedo ayudar?" }]`).
   - We will utilize `PUT /api/settings` to save quick replies, and `GET /api/settings` or update `GET /api/connection/status` to retrieve them.

2. **API Modifications**:
   - Update `GET /api/connection/status` (`src/app/api/connection/status/route.ts`) to return `botProfile` from the database `settings.bot_profile` if connected.

3. **Frontend Changes**:
   - **DashboardHeader Component**: Add a "Perfil" button next to "Desconectar" when connected.
   - **Profile Modal**: A premium-designed dialog/modal that displays:
     - Profile image (expanding on click/zoom).
     - Phone number, Status/Bio.
     - Business description (category, email, websites, address) if business profile exists.
     - Quick Replies Manager: lists existing quick replies, allows adding new ones (shortcut and response text), editing, and deleting them, then saving via `/api/settings`.
   - **ConversationPanel Component**:
     - Fetch quick replies from `/api/settings` (or pass them down).
     - Listen to input changes in the chat input. If the input contains `/` (either starts with or has `/` followed by search text, e.g. `/hola`), display a floating quick replies dropdown above the input.
     - Support keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) to select a reply, replacing the `/shortcut` text with the full quick reply text and focusing the input.

## Risk Assessment
- **UI Collision**: The quick replies dropdown must position itself correctly above the message composer input without blocking message scroll or causing visual glitches on mobile.
- **State Sync**: When quick replies are updated in the Profile Modal, the `ConversationPanel` needs to reflect these changes immediately. We can store quick replies in a shared React Context, or simple React State at the dashboard home level (`src/app/page.tsx`) and pass it down, or have `ConversationPanel` fetch it. Passing down from `Home` is cleaner as it keeps state in one place and syncs it.

## Next Phase
- Move to **Specs** to define exact schemas and UI details.

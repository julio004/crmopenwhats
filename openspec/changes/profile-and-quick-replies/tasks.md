# Tasks: Profile Modal & Quick Replies (/)

- [ ] **Phase 1: Backend/API Implementation**
  - [ ] Modify `src/app/api/connection/status/route.ts` to include `botProfile` querying the `bot_profile` key in database settings.
  - [ ] Verify endpoint response by checking the JSON output.

- [ ] **Phase 2: Global State and Context Hookup**
  - [ ] Modify `src/components/ConnectionGate.tsx` to return `botProfile` via the children render-prop.
  - [ ] Modify `src/app/page.tsx` to handle state for `quickReplies`.
  - [ ] Fetch quick replies in `src/app/page.tsx` on mount using `GET /api/settings` and populate the state.
  - [ ] Adapt children call in `src/app/page.tsx` to receive `botProfile` and pass it along with `quickReplies` to header and panels.

- [ ] **Phase 3: DashboardHeader & Profile Modal UI**
  - [ ] Add "Perfil" button in `src/components/DashboardHeader.tsx` (using styling similar to existing premium buttons, next to "Desconectar").
  - [ ] Implement the Modal overlay state.
  - [ ] Design the profile info tab (avatar, status, phone, business description).
  - [ ] Design the quick replies manager tab (add, edit, list, delete, save).
  - [ ] Make the save action invoke `PUT /api/settings` and call `onQuickRepliesUpdated` to sync state globally.
  - [ ] Add image zoom modal for the bot profile photo.

- [ ] **Phase 4: Chat Quick Replies autocomplete (/)**
  - [ ] Modify `src/components/ConversationPanel.tsx` to accept `quickReplies` as a prop.
  - [ ] Implement trigger parsing on chat input `onChange` (looking for `/` triggers).
  - [ ] Design the floating quick replies dropdown overlay above the composer input.
  - [ ] Add keyboard listener (`onKeyDown`) to handle selection with Arrow keys, Enter, and Escape.
  - [ ] Implement replace-on-select logic, input focus, and dropdown close.

- [ ] **Phase 5: Verification & Review**
  - [ ] Run the test suite (`npm run test`) to ensure we haven't broken any existing behavior.
  - [ ] Build the Next.js app to make sure there are no TypeScript or Turbopack compilation errors.

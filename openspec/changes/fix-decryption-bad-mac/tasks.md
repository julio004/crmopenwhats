# Tasks: Fix WhatsApp Decryption Bad MAC Errors

- [ ] **Phase 1: Implement remediation logic**
  - [ ] Edit `src/lib/baileys/client.ts` to add detection of decryption failures inside `messages.upsert` listener.
  - [ ] Add dynamic `sock.assertSessions` invocation wrapped in defensive try-catch blocks.

- [ ] **Phase 2: Validation**
  - [ ] Run typescript checks and production builds using `npm run build`.
  - [ ] Run test suite using `npm run test`.

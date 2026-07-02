# Specification: Fix WhatsApp Decryption Bad MAC Errors

## 1. Detection Criteria
A message is determined to have failed decryption if:
1. `!msg.message` (there is no message payload).
2. `msg.messageStubType !== undefined` (Baileys parsed it as a stub/ciphertext placeholder due to decryption error or fallback stub).
3. `msg.key.remoteJid` is present (meaning there is a valid target JID).
4. `msg.key.remoteJid` ends with `@s.whatsapp.net` or `@lid` (indicating a standard 1:1 chat).

## 2. Session Assertion Remediation
When a decryption failure is detected:
- The bot must invoke `await sock.assertSessions([remoteJid], true)` to force a Signal session renegotiation with that WhatsApp ID.
- This invocation must be safely wrapped in a `try/catch` block to prevent any API or network exceptions from interrupting the connection loop.
- It must log warnings and success statuses so that operators can verify session resets.

# Proposal: Fix WhatsApp Decryption Bad MAC Errors

## Goal
Resolve the WhatsApp message decryption failure (`Bad MAC Error: Bad MAC` / `Failed to decrypt message with any known session...`) that occurs programmatically in Baileys when cryptographic keys/prekeys get desynchronized, without requiring the user to disconnect and re-authenticate via QR code.

## Analysis
- In Baileys, decryption errors emit a `messages.upsert` event with a message containing no parsed `.message` content, but rather a `messageStubType` (e.g. `1` / `CIPHERTEXT`).
- In these cases, the local Signal session with the corresponding JID has corrupted or desynchronized keys.
- Baileys provides the `sock.assertSessions([jid], force)` method which forces the recreation or assertion of the cryptographic Signal session for the specified JID list by obtaining a fresh prekey bundle from WhatsApp servers.
- By intercepting these failed-to-decrypt messages inside the `messages.upsert` handler, we can automatically trigger `sock.assertSessions([msg.key.remoteJid], true)` in the background. The next incoming retry or interaction from the client will then be decrypted successfully.

## Affected Files
- `src/lib/baileys/client.ts`: The socket connection manager where the `messages.upsert` listener is registered.

## Next Phase
- Move to **Specs** to outline criteria and validation methods.

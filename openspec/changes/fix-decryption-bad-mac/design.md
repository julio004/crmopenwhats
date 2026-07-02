# Design: Fix WhatsApp Decryption Bad MAC Errors

## 1. Code Changes in `src/lib/baileys/client.ts`

We will modify the `messages.upsert` handler to inspect each incoming message. If a message is a ciphertext stub, it means the keys are desynchronized. We will immediately attempt session assertion.

```typescript
	// Registro del handler de mensajes entrantes con depuración
	sock.ev.on("messages.upsert", async (upsert: any) => {
		console.log(
			`[bot-debug] messages.upsert recibido. Tipo: ${upsert.type}, Cantidad: ${upsert.messages?.length}`,
		);
		for (const msg of upsert.messages || []) {
			console.log(
				`[bot-debug] Mensaje key: ${JSON.stringify(msg.key)}, pushName: ${msg.pushName}, timestamp: ${msg.messageTimestamp}`,
			);

			// Detectar si el mensaje no pudo ser desencriptado (Bad MAC / Ciphertext stub)
			const isDecryptionFailure = !msg.message && msg.messageStubType !== undefined;
			if (isDecryptionFailure && msg.key.remoteJid) {
				const remoteJid = msg.key.remoteJid;
				// Aplicar solo para chats 1:1 (@s.whatsapp.net o @lid)
				if (remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid")) {
					console.warn(
						`[bot-warning] Detectado posible error de desencriptación (Bad MAC) para el JID ${remoteJid}. Forzando recreación de sesión de Signal...`
					);
					try {
						await sock.assertSessions([remoteJid], true);
						console.log(`[bot] Sesión de Signal para ${remoteJid} restablecida exitosamente.`);
					} catch (err) {
						console.error(`[bot-error] Falló al restablecer la sesión de Signal para ${remoteJid}:`, err);
					}
				}
			}
		}
		try {
			await inboundHandler.handleUpsert(upsert);
		} catch (error) {
			console.error(
				"[bot] Error procesando mensaje entrante en handleUpsert:",
				error,
			);
		}
	});
```
This is fully backwards compatible and will run inside the message loop gracefully.

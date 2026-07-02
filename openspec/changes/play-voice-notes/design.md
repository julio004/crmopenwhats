# Design: Escuchar Notas de Voz y Visualizar Imágenes en la App

## 1. Modificaciones en el Inbound Handler (`src/lib/baileys/inbound-handler.ts`)

```typescript
// En la interfaz InboundHandlerDeps:
export interface InboundHandlerDeps {
	...
	fetchProfilePictureUrl?: (jid: string) => Promise<string | null>;
	downloadMedia?: (message: WhatsAppMessage) => Promise<Buffer | null>; // Añadido
}

// En handleMessage(), antes de llamar a insertMessageAndTouchConversation (L320):
		let messageMetadata: Record<string, any> = {};
		if ((mediaType === "audio" || mediaType === "image") && deps.downloadMedia && whatsappMessageId) {
			try {
				const buffer = await deps.downloadMedia(message);
				if (buffer) {
					const fs = await import("node:fs");
					const path = await import("node:path");
					const mediaDir = path.join(process.cwd(), "public", "media");
					if (!fs.existsSync(mediaDir)) {
						fs.mkdirSync(mediaDir, { recursive: true });
					}
					const extension = mediaType === "audio" ? "ogg" : "jpg";
					const filename = `${whatsappMessageId}.${extension}`;
					const filePath = path.join(mediaDir, filename);
					fs.writeFileSync(filePath, buffer);
					messageMetadata.mediaUrl = `/media/${filename}`;
					console.log(`[bot] Guardado archivo multimedia (${mediaType}) en ${filePath}`);
				}
			} catch (err) {
				console.error(`[bot-error] Falló al descargar/guardar archivo de ${mediaType}:`, err);
			}
		}

		try {
			const inboundMessage = await deps.repo.insertMessageAndTouchConversation({
				conversation_id: beforeConversation.id,
				whatsapp_message_id: whatsappMessageId ?? null,
				direction: fromMe ? "outbound" : "inbound",
				role,
				content: text,
				media_type: mediaType,
				source: "whatsapp",
				from_me: fromMe,
				raw_timestamp: createdAt,
				created_at: createdAt,
				metadata: messageMetadata, // Añadido
			});
```

## 2. Modificaciones en el Cliente Baileys (`src/lib/baileys/client.ts`)

```typescript
// En las importaciones:
import makeWASocket, {
	DisconnectReason,
	useMultiFileAuthState,
	fetchLatestBaileysVersion,
	downloadMediaMessage, // Añadir
} from "@whiskeysockets/baileys";

// En la inyección de dependencias de createInboundHandler (L53):
export const inboundHandler = createInboundHandler({
	now: () => new Date(),
	repo: { ... },
	...
	downloadMedia: async (message) => {
		try {
			const buffer = await downloadMediaMessage(
				message as any,
				"buffer",
				{},
				{
					logger,
					reuploadRequest: globalSock ? globalSock.updateMediaMessage : undefined,
				}
			);
			return buffer;
		} catch (error) {
			console.error("[bot-error] Falló al descargar mensaje multimedia:", error);
			return null;
		}
	},
});
```

## 3. Modificaciones en el Renderizado (`src/components/MessageBubble.tsx`)

```typescript
// En MessageBubble (L10):
export default function MessageBubble({ message }: { message: MessageRow }) {
	const { role, content, media_type, created_at, metadata } = message; // Extraer metadata

// En el render de tipos de medios (L60):
				{media_type === "image" && (
					<div className="flex flex-col gap-2 mb-2 p-2 bg-background/50 rounded-2xl border border-outline-variant/10">
						{metadata?.mediaUrl ? (
							<img
								src={metadata.mediaUrl}
								alt="Imagen de WhatsApp"
								className="max-w-full max-h-[200px] rounded-xl object-contain cursor-pointer hover:brightness-95 transition-all"
								onClick={() => window.open(metadata.mediaUrl as string, '_blank')}
							/>
						) : (
							<div className="flex items-center gap-2 text-[10px] text-on-surface-variant/90 font-medium">
								<ImageIcon className="text-primary" size={12} />
								<span>Imagen recibida (Procesada por IA Multimodal)</span>
							</div>
						)}
					</div>
				)}
				{media_type === "audio" && (
					<div className="flex flex-col gap-2 mb-2 p-3 bg-background/50 rounded-2xl border border-outline-variant/10">
						<div className="flex items-center gap-2 text-[10px] text-on-surface-variant/90 font-medium">
							<MicIcon className="text-primary" size={12} />
							<span>Nota de voz</span>
						</div>
						{metadata?.mediaUrl ? (
							<audio
								src={metadata.mediaUrl as string}
								controls
								className="w-full h-8 mt-1 focus:outline-none"
							/>
						) : (
							<span className="text-[10px] text-on-surface-variant/60 italic">
								Transcribiendo o descargando...
							</span>
						)}
					</div>
				)}
```

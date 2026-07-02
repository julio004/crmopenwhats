# Proposal: Escuchar Notas de Voz y Visualizar Imágenes en la App

## Goal
Permitir al usuario escuchar las notas de voz recibidas y visualizar las imágenes adjuntas directamente desde la burbuja de chat en el dashboard, en vez de mostrar únicamente textos descriptivos/placeholders.

## Analysis
- **Descarga de Multimedia (Backend)**:
  - Definir en `InboundHandlerDeps` la función `downloadMedia?: (message: WhatsAppMessage) => Promise<Buffer | null>`.
  - Inyectar esta dependencia en `src/lib/baileys/client.ts` utilizando la utilidad `downloadMediaMessage` de Baileys.
  - En `inbound-handler.ts`, si el mensaje entrante es de tipo `"audio"` o `"image"`, descargar su contenido utilizando `downloadMedia`, guardarlo físicamente en la carpeta `public/media/` bajo el nombre `${whatsappMessageId}.${extension}` y guardar la URL relativa (`/media/${filename}`) dentro de la propiedad `metadata.mediaUrl` del mensaje antes de persistirlo.
- **Visualización en Interfaz (Frontend)**:
  - En [MessageBubble.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/MessageBubble.tsx), extraer `metadata` de las propiedades del mensaje.
  - Para audios (`media_type === "audio"`): si `metadata.mediaUrl` existe, renderizar un reproductor HTML5 `<audio src={metadata.mediaUrl} controls className="..." />`.
  - Para imágenes (`media_type === "image"`): si `metadata.mediaUrl` existe, renderizar una etiqueta `<img src={metadata.mediaUrl} className="..." onClick={() => window.open(metadata.mediaUrl, '_blank')} />`.

## Affected Files
- [src/lib/baileys/inbound-handler.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/inbound-handler.ts)
- [src/lib/baileys/client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts)
- [src/components/MessageBubble.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/MessageBubble.tsx)

## Next Phase
- Avanzar a **Specs** para detallar las especificaciones.

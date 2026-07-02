# Specification: Escuchar Notas de Voz y Visualizar Imágenes en la App

## 1. Descarga e Inserción

### 1.1 Inyección de Dependencia
- Se añadirá `downloadMedia?: (message: WhatsAppMessage) => Promise<Buffer | null>` en `InboundHandlerDeps` (`src/lib/baileys/inbound-handler.ts`).
- En `src/lib/baileys/client.ts`, se implementará esta función llamando a `downloadMediaMessage` de Baileys.

### 1.2 Persistencia Física y Metadatos
- En `handleMessage()` de `inbound-handler.ts`:
  - Si `mediaType` es `"audio"` o `"image"`, e interactúa con un `whatsappMessageId` válido, descargar el buffer.
  - Crear la ruta física `/app/public/media/` si no existe.
  - Guardar el archivo local con extensión `.ogg` para audio o `.jpg` para imágenes.
  - Construir e inyectar `metadata: { mediaUrl: "/media/${filename}" }` en la inserción a base de datos.

## 2. Renderizado en UI

### 2.1 Reproductor de Audio
- En `MessageBubble.tsx`, si `media_type === "audio"` y `metadata.mediaUrl` está disponible:
  - Mostrar la etiqueta nativa `<audio>` con controles.
- De lo contrario, mantener el texto informativo descriptivo.

### 2.2 Visor de Imagen
- En `MessageBubble.tsx`, si `media_type === "image"` y `metadata.mediaUrl` está disponible:
  - Mostrar la etiqueta `<img>` correspondiente, con un link o acción onClick para abrirla en pantalla completa (`window.open`).
- De lo contrario, mantener el texto informativo.

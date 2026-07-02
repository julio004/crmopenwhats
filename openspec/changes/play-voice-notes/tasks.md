# Tasks: Escuchar Notas de Voz y Visualizar Imágenes en la App

- [x] **Phase 1: Descarga en Inbound Handler**
  - [x] Añadir `downloadMedia` a `InboundHandlerDeps` en [inbound-handler.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/inbound-handler.ts).
  - [x] Implementar la descarga, persistencia física en `/public/media/` y propagación de metadatos en `inbound-handler.ts`.

- [x] **Phase 2: Inyección de Dependencia Baileys**
  - [x] Registrar la importación de `downloadMediaMessage` en [client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts).
  - [x] Inyectar el método `downloadMedia` al instanciar `createInboundHandler` en `client.ts`.

- [x] **Phase 3: Renderizado en UI**
  - [x] Extraer y renderizar `metadata.mediaUrl` como reproductor de audio / visor de imágenes en [MessageBubble.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/MessageBubble.tsx).

- [x] **Phase 4: Verificación**
  - [x] Compilar el proyecto (`npm run build` y `npx tsc --noEmit`).
  - [x] Ejecutar el suite de pruebas (`npm test`).

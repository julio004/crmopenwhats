# Tasks: Sincronización Completa de Contactos al Conectar (Estilo Evolution API)

- [ ] **Phase 1: Capa de Datos y API**
  - [ ] Modificar `listConversations` en [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) para soportar la opción `hasMessages`.
  - [ ] Modificar `GET` en [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/route.ts) para soportar el parámetro de query `hasMessages`.

- [ ] **Phase 2: Eventos del Cliente Baileys**
  - [ ] Cambiar el procesamiento de `contacts.upsert` y `contacts.update` en [client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts) para usar `getOrCreateConversation`.

- [ ] **Phase 3: Frontend UI**
  - [ ] Modificar [page.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/page.tsx) para implementar la carga separada de todos los contactos en la pestaña Contactos y el filtrado por `hasMessages` en el sidebar.

- [ ] **Phase 4: Verificación**
  - [ ] Compilar el proyecto (`npm run build` y `npx tsc --noEmit`).
  - [ ] Ejecutar el suite de pruebas (`npm test`).

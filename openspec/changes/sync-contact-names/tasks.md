# Tasks: Sincronizar nombres de contactos desde la libreta de direcciones de WhatsApp

- [ ] **Phase 1: Capa de Datos**
  - [ ] Implementar la función `updateConversationNameIfExists` en [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts).

- [ ] **Phase 2: Eventos del Cliente Baileys**
  - [ ] Registrar la importación en [client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts).
  - [ ] Registrar los listeners de `contacts.upsert` y `contacts.update` en `client.ts`.

- [ ] **Phase 3: Verificación**
  - [ ] Compilar el proyecto (`npm run build` y `npx tsc --noEmit`).
  - [ ] Ejecutar el suite de pruebas (`npm test`).

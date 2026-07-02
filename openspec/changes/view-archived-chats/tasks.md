# Tasks: Visualizar y Desarchivar Chats

- [ ] **Phase 1: Backend & Database**
  - [ ] Actualizar `listConversations` en [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) para usar parámetro `$1` e incorporar `options.archived`.
  - [ ] Modificar el endpoint `GET /api/conversations` en [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/route.ts) para leer la query `archived`.

- [ ] **Phase 2: Frontend & UI Components**
  - [ ] Modificar [page.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/page.tsx) para controlar el estado `showArchived` y refrescar.
  - [ ] Modificar [ConversationList.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationList.tsx) para incluir el botón "Ver archivados" / "Ver activos".
  - [ ] Modificar [ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx) para cambiar dinámicamente entre "Archivar" / "Desarchivar".

- [ ] **Phase 3: Verificación**
  - [ ] Ejecutar build de Next.js (`npm run build`).
  - [ ] Ejecutar la suite de pruebas (`npm test`).

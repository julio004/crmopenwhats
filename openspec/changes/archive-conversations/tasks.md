# Tasks: Archivar Chats para ocultarlos de la pantalla principal

- [ ] **Phase 1: Base de datos y Backend API**
  - [ ] Modificar [db-contract.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db-contract.ts) (Esquema, Interfaz e InMemoryRepository).
  - [ ] Modificar [postgres-adapter.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/postgres-adapter.ts) (Migración y Lista Blanca).
  - [ ] Modificar [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) (Filtro en listConversations).
  - [ ] Modificar [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/[conversationId]/route.ts) (PATCH Handler).

- [ ] **Phase 2: Frontend UI**
  - [ ] Modificar [Icons.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/Icons.tsx) (Agregar ArchiveIcon).
  - [ ] Modificar [ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx) (Agregar botón y lógica).

- [ ] **Phase 3: Verificación**
  - [ ] Ejecutar build de Next.js (`npm run build`) para verificar tipos.
  - [ ] Ejecutar suite de pruebas (`npm run test`).

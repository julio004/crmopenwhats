# Proposal: Visualizar y Desarchivar Chats

## Goal
Permitir al usuario ver la lista de chats archivados desde la interfaz y dar la opción de desarchivarlos para que regresen a la bandeja principal.

## Analysis
- **API & Base de Datos**:
  - Actualizar `listConversations` en [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) para aceptar un objeto de opciones: `listConversations(options?: { archived?: boolean })`.
  - Actualizar el endpoint `GET /api/conversations` en [route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/route.ts) para leer la query `?archived=true` y pasarla a `listConversations`.
- **UI de Listado de Chats (`ConversationList.tsx` y `page.tsx`)**:
  - En `page.tsx`, mantener el estado `showArchived` y cargar los chats en base a él.
  - Pasar `showArchived` y `onToggleArchived` como props a `ConversationList`.
  - En la cabecera de `ConversationList`, añadir un botón de alternancia: "Ver Archivados" / "Ver Activos".
- **UI del Chat Seleccionado (`ConversationPanel.tsx`)**:
  - Si `conversation.is_archived` es `true`, renderizar el botón "Desarchivar" (con un texto y tooltip apropiados) en lugar de "Archivar".
  - Al hacer click en "Desarchivar", enviar `PATCH /api/conversations/[conversationId]` con `{ is_archived: false }` y refrescar.

## Affected Files
- [src/lib/db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts)
- [src/app/api/conversations/route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/route.ts)
- [src/components/ConversationList.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationList.tsx)
- [src/app/page.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/page.tsx)
- [src/components/ConversationPanel.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/components/ConversationPanel.tsx)

## Next Phase
- Avanzar a **Specs** para detallar las especificaciones técnicas.

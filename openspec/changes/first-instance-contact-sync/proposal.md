# Proposal: Sincronización Completa de Contactos al Conectar (Estilo Evolution API)

## Goal
Sincronizar y persistir todos los contactos de la agenda telefónica del dueño del bot al conectar (evento `contacts.upsert`), creando las filas correspondientes en la base de datos sin importar si tienen o no mensajes previos, de modo que la pestaña "Contactos" funcione como un CRM completo desde el primer instante.

## Analysis
- **Estrategia de Almacenamiento**:
  - En `contacts.upsert` y `contacts.update`, utilizar `getOrCreateConversation` para crear o actualizar el registro de cada contacto de la agenda.
  - Esto poblará la tabla `conversations` con todos los contactos reales.
- **Filtro de Chats Activos en Sidebar**:
  - Para evitar que la lista lateral de "Chats Activos" se llene de chats vacíos de la agenda, modificaremos `listConversations` en [db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) para permitir el filtrado `hasMessages?: boolean`.
  - El endpoint `GET /api/conversations` expondrá este parámetro `?hasMessages=true`.
  - La lista de "Chats Activos" cargará `/api/conversations?hasMessages=true` para ocultar los contactos vacíos.
  - La pestaña "Contactos" cargará `/api/conversations?archived=false` para mostrar todo el CRM sincronizado.

## Affected Files
- [src/lib/db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts)
- [src/app/api/conversations/route.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/api/conversations/route.ts)
- [src/app/page.tsx](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/app/page.tsx)
- [src/lib/baileys/client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts)

## Next Phase
- Crear las especificaciones detalladas.

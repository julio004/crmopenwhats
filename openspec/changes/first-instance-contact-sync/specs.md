# Specification: Sincronización Completa de Contactos al Conectar (Estilo Evolution API)

## 1. Capa de Datos y API

### 1.1 `listConversations`
- Acepta la opción `options: { archived?: boolean, hasMessages?: boolean }`.
- Si `options.hasMessages` es `true`, añade la condición `AND (c.last_message_at IS NOT NULL OR c.unread_count > 0)` a la consulta SQL.

### 1.2 Endpoint `GET /api/conversations`
- Parsea `hasMessages` de la query string (`searchParams.get("hasMessages") === "true"`).
- Delega el parámetro a la función `listConversations`.

## 2. Eventos del Cliente Baileys

### 2.1 Sincronización Completa
- En `src/lib/baileys/client.ts`, al capturar `contacts.upsert` o `contacts.update`, se debe usar `getOrCreateConversation(phone, contact.id, name)` en lugar de `updateConversationNameIfExists`.
- Esto asegura la persistencia de todos los contactos de la libreta de direcciones de WhatsApp de forma proactiva.

## 3. Frontend y UX

### 3.1 Lista Lateral de Chats (Sidebar)
- En `page.tsx`, `loadConversations` consulta la API con `hasMessages=true`.
- Esto mantiene la lista principal libre de contactos de agenda con los que no hay historial de chat.

### 3.2 Pestaña de Contactos CRM
- En `page.tsx`, la pestaña "Contactos" utiliza un estado e interactividad dedicado `contactsList` cargado a través de `loadAllContacts()` sin filtro de mensajes (`hasMessages=false` o no enviado).

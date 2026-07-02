# Specification: Sincronizar nombres de contactos desde la libreta de direcciones de WhatsApp

## 1. Comportamiento en la Base de Datos

### 1.1 Función de Actualización
- Se debe definir la función `updateConversationNameIfExists(jid: string, name: string): Promise<void>` en `src/lib/db.ts`.
- Esta función debe:
  1. Extraer el número de teléfono limpio a partir del `jid`.
  2. Ejecutar un query `UPDATE` condicional sobre la tabla `conversations`.
  3. El `UPDATE` debe aplicar solo si existe una conversación con ese `phone` o `jid`, y si el campo `name` actual es nulo, vacío, o diferente de la agenda.
  4. Debe omitir actualizaciones si el nombre proporcionado es `"Azokia"` o `"Azokiallc"` (guarda contra sobreescritura con el perfil del dueño).

## 2. Eventos de Conexión de WhatsApp (Baileys)

### 2.1 Evento `contacts.upsert`
- El cliente global en `src/lib/baileys/client.ts` debe suscribirse al evento `contacts.upsert`.
- Por cada contacto recibido, se debe validar:
  - Que tenga un `id` (JID) válido.
  - Que no sea un grupo (`@g.us`).
  - Obtener el nombre prioritario en orden: `contact.name`, `contact.notify`, `contact.verifiedName`.
- Si se encuentra un nombre válido, invocar `updateConversationNameIfExists(contact.id, name)`.

### 2.2 Evento `contacts.update`
- El cliente global debe suscribirse al evento `contacts.update` y realizar exactamente el mismo procesamiento que `contacts.upsert` para capturar actualizaciones en tiempo real.

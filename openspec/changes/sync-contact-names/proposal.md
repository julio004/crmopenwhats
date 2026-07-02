# Proposal: Sincronizar nombres de contactos desde la libreta de direcciones de WhatsApp

## Goal
Permitir que el bot obtenga y actualice automáticamente los nombres reales de los contactos (sincronizados desde la agenda del teléfono del dueño) cuando se interactúa con ellos, previniendo que se muestren únicamente como números de teléfono o nombres incorrectos cuando se inicia una conversación desde WhatsApp normal.

## Analysis
- **Baileys Events**:
  - Baileys emite los eventos `contacts.upsert` (al conectar y recibir la lista de contactos sincronizados) y `contacts.update` (cuando cambian los datos de un contacto).
  - Estos eventos envían un listado de objetos `Contact` que contienen la propiedad `name` (nombre guardado en la agenda del teléfono) y `notify` (pushName público).
- **Estrategia sin Bloat**:
  - Para evitar llenar la base de datos con miles de contactos de la agenda con los que nunca se ha chateado, implementaremos una función que actualice el nombre **únicamente si la conversación ya existe** en nuestra base de datos.
  - Al recibir `contacts.upsert` o `contacts.update`, buscaremos la conversación existente por teléfono o JID y actualizaremos su propiedad `name` si es nula, vacía o diferente.
  - Mantendremos una guarda preventiva para no asignar el nombre de perfil del dueño ("Azokia" / "Azokiallc").

## Affected Files
- [src/lib/db.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/db.ts) (Definición de `updateConversationNameIfExists`)
- [src/lib/baileys/client.ts](file:///C:/Users/Asistente/Desktop/Nueva_carpeta/Bot-personal/src/lib/baileys/client.ts) (Escucha de eventos `contacts.upsert` y `contacts.update`)

## Next Phase
- Crear las especificaciones y el diseño detallado.

# Proposal: Normalizar turnos de WhatsApp, bloqueo/activación por dueño y seguimientos

## Change ID

`normalize-whatsapp-turns-followups`

## Problema

El repositorio define un bot local de WhatsApp con Baileys, PostgreSQL, Redis y DeepSeek, pero las referencias actuales (`concepto.json` y `seguimiento.json`) vienen de flujos n8n con Evolution/WhatsApp API oficial, OpenAI, tablas/memoria propias de n8n y estado temporal en Redis. Esa interpretación necesita migrarse a la pila local real indicada en `promt.md` y formalizar reglas operativas para que cada mensaje entrante sea un turno de procesamiento confiable.

Actualmente también hay ambigüedad entre:

- mensajes entrantes de clientes vs mensajes enviados por el dueño desde su WhatsApp;
- modo automático del bot vs intervención humana;
- follow-ups automáticos vs conversación normal;
- el cierre del turno de procesamiento vs conservar la sesión de autenticación de Baileys;
- envío posterior a 24 horas, que puede verse como spam o quedar fuera de ventanas de respuesta permitidas.

## Intento

Definir una especificación implementable para que el bot:

1. procese cada mensaje inbound como un turno completo;
2. persista y use historial antes de responder;
3. cierre estado transitorio del turno sin cerrar la sesión Baileys;
4. apague automáticamente el bot para un chat cuando el dueño escribe desde su WhatsApp, salvo cuando use la keyword de activación;
5. permita reactivar el bot desde WhatsApp con `bot_on_keyword` (`ok.` por defecto) o desde el dashboard;
6. ejecute follow-ups compatibles con `seguimiento.json` cada 12 horas sin colisionar con mensajes normales y sin salir de la ventana segura de 24 horas;
7. muestre Contactos CRM desde conversaciones persistidas, sin datos hardcodeados;
8. adapte los flujos JSON a la pila local del proyecto.

## Objetivos

- Cada mensaje entrante 1:1 de WhatsApp debe disparar un turno de procesamiento: guardar mensaje, leer historial, decidir modo, responder si aplica, persistir salidas y limpiar estado transitorio.
- La respuesta del LLM debe construirse con historial reciente de la conversación y el system prompt activo.
- El cierre del turno debe limpiar colas, locks, timers y estados temporales asociados al mensaje/conversación, sin cerrar ni borrar `./auth/` ni desconectar Baileys.
- El dashboard/settings debe permitir configurar la keyword de activación/reactivación del bot por chat, ejemplo `ok.`; no debe existir configuración de palabra para apagar el bot.
- Solo el dueño, escribiendo desde su propio WhatsApp en un chat (`fromMe === true`), puede reactivar el bot con esa keyword.
- Si el dueño escribe desde su WhatsApp y el texto no coincide con la keyword de activación, el chat pasa o permanece en `HUMAN`/bot apagado, se refresca la intervención humana y el bot no responde.
- La regla debe seguir el flujo tipo etiqueta de `concepto.json`: Redis puede mantener labels/locks transitorios para checks en runtime, pero el modo duradero `AI`/`HUMAN` vive en PostgreSQL.
- La reactivación por WhatsApp ocurre con `bot_on_keyword`; cualquier otro mensaje del dueño reinicia la intervención humana/off para ese chat.
- Follow-ups deben ejecutarse solo cuando el último mensaje visible sea del bot y el usuario no haya respondido después.
- Si el usuario responde a un follow-up, el procesamiento normal inbound debe retomar y los intentos de seguimiento deben reiniciarse/cancelarse.
- Conversaciones y mensajes deben tener estados/labels suficientes (`AI`/`HUMAN`, `user`/`assistant`/`human`, timestamps, intentos de seguimiento, último emisor, ventanas temporales).
- La lógica debe considerar la ventana de 24 horas de WhatsApp: evaluar follow-ups cada 12 horas, pedir decisión SI/NO a DeepSeek y no enviar free-form automático fuera de ventana si se considera no permitido o riesgoso.
- Contactos CRM debe consumir datos persistidos de `/api/conversations` ya cargados por Home; no debe renderizar contactos ficticios ni inventar status/tags no persistidos.

## No objetivos

- No editar `promt.md` en esta fase.
- No implementar código de aplicación todavía.
- No migrar literalmente nodos n8n ni dependencias n8n.
- No usar OpenAI, SDK de OpenAI, Meta API oficial, Twilio, Prisma, Drizzle, Supabase, WebSockets ni Vercel.
- No cerrar la sesión Baileys como parte del cierre normal de un turno.
- No definir autenticación del dashboard más allá de mantener el riesgo documentado para producción.

## Alcance

### Procesamiento inbound por turno

Para cada `messages.upsert` válido (`type: notify`, 1:1, no grupo):

1. Identificar si el mensaje viene del usuario externo o del dueño (`fromMe === true`).
2. Crear/obtener conversación por teléfono/JID.
3. Persistir el mensaje en PostgreSQL con rol y timestamp:
   - `user`: cliente externo;
   - `human`: dueño o asesor humano;
   - `assistant`: bot.
4. Actualizar `last_message_at`, `last_inbound_at`, `last_user_message_at`, `last_human_message_at` o equivalentes necesarios.
5. Si el mensaje es de usuario externo, cancelar/reiniciar follow-ups pendientes para esa conversación.
6. Leer historial reciente antes de cualquier respuesta AI.
7. Evaluar modo actual (`AI`/`HUMAN`) y keywords del dueño.
8. Si corresponde responder con IA, llamar a DeepSeek con historial + prompt activo y enviar respuesta en partes.
9. Persistir cada respuesta enviada por el bot.
10. Cerrar el turno limpiando estado transitorio: colas Redis del debounce, locks, timers, marcas `processing`, deduplicación temporal del mensaje y cualquier lease de conversación.

### Control de modo por dueño

- Agregar setting solo para `bot_on_keyword`; no debe existir setting ni UI para una palabra de apagado.
- La comparación de activación debe ser normalizada y segura: trim, case-insensitive opcional/configurable, y coincidencia exacta por defecto para evitar falsos positivos.
- Si el dueño envía `bot_on_keyword` desde su WhatsApp en un chat, esa conversación cambia a `AI`/bot activo y futuros mensajes de usuario quedan elegibles para IA.
- Si el dueño envía cualquier otro mensaje desde su WhatsApp en un chat, esa conversación cambia o permanece en `HUMAN`/bot apagado, refresca `last_owner_intervention_at`/estado equivalente y evita respuesta AI.
- Ejemplo permitido para activación: `ok.`.
- Las mismas palabras enviadas por clientes externos no deben activar ni desactivar el bot como orden administrativa; si se desea derivar a humano por intención del cliente, eso queda como regla separada de conversación/LLM.

### Reactivación por dueño

- Si el dueño escribe `bot_on_keyword` en una conversación que estaba en `HUMAN`/bot bloqueado, el sistema debe reactivar el bot para ese chat.
- Si el dueño escribe cualquier otro mensaje, el sistema debe mantener o poner el chat en `HUMAN` y reiniciar/refrescar la intervención humana/off.
- La reactivación debe registrarse con timestamp y label/audit trail suficiente.
- Esta regla no debe cerrar Baileys ni borrar auth.

### Follow-ups

Adaptar `seguimiento.json` a un scheduler local (`node-cron` o `setInterval` robusto):

- Evaluar periódicamente cada 12 horas o usar una marca de vencimiento equivalente de 12 horas por conversación.
- Buscar conversaciones en modo `AI` cuyo último mensaje sea `assistant`, donde el usuario no haya hablado después, `followup_attempts < 2`, y la evaluación esté vencida; no esperar 24 horas desde el mensaje assistant.
- Usar historial reciente para pedir a DeepSeek JSON estricto: `{ "respuesta": "SI" | "NO", "mensaje": "..." }`.
- Enviar solo si `respuesta === "SI"`, persistir el mensaje como `assistant` y aumentar `followup_attempts`.
- No ejecutar seguimiento si hay cola/lock de procesamiento inbound activo para esa conversación.
- No ejecutar seguimiento si el último mensaje ya no es del bot o si el usuario respondió.
- Si el usuario responde a un follow-up, el turno normal inbound toma prioridad y reinicia los intentos.
- Respetar ventana de 24 horas: los follow-ups free-form solo deben enviarse dentro de ventana permitida o quedar bloqueados/registrados para intervención humana si ya venció.

### Prompt y flujo comercial

Adaptar el comportamiento de `concepto.json` al prompt activo local:

- ventas consultivas para Azokia LLC / sistema de restaurante según prompt activo;
- respuestas breves, conversacionales y orientadas a siguiente paso;
- no vender antes de entender necesidad;
- no dar precio final sin contexto suficiente;
- derivar a humano cuando el cliente esté listo para cerrar, pida persona, esté molesto o falte información crítica;
- cuando el LLM determine derivación humana, persistir la decisión y cambiar el chat a `HUMAN` sin depender de herramientas n8n.

## Áreas afectadas

- Base de datos PostgreSQL:
  - `conversations` para modo, timestamps, followups, owner override y/o estado de bot por chat.
  - `messages` para roles, media, timestamps y trazabilidad.
  - posible tabla `settings` para keywords globales y parámetros de follow-up.
  - posible tabla/audit de eventos de modo (`bot_disabled`, `bot_enabled`, `owner_intervention`).
- Redis:
  - colas de debounce por conversación;
  - locks/leases de procesamiento;
  - deduplicación temporal de mensajes;
  - timers/flags transitorios que deben limpiarse al finalizar turno.
- Baileys handler:
  - distinción `fromMe` dueño vs cliente;
  - no ignorar todos los `fromMe` si son necesarios para control administrativo del chat;
  - extracción de texto/media y persistencia antes de decisiones.
- DeepSeek client:
  - llamada de conversación normal con historial y prompt activo;
  - llamada de follow-up con JSON estricto.
- Scheduler de follow-ups.
- Dashboard/settings:
  - edición de la keyword de activación y visualización de modo/estado/timestamps.
- Contactos CRM:
  - tabla derivada de `/api/conversations`/conversaciones persistidas, sin contactos hardcodeados.
- Documentación futura (`promt.md`/README), fuera de esta fase.

## Criterios de aceptación

1. Dado un mensaje inbound de un cliente, el sistema lo guarda antes de responder y la respuesta AI usa historial reciente de esa conversación.
2. Dado cualquier turno inbound válido, al finalizar se limpian locks, colas, timers y estado transitorio de ese turno/conversación sin cerrar la sesión Baileys.
3. Dado un chat en modo `AI`, si el dueño envía cualquier mensaje desde su WhatsApp que no coincide con `bot_on_keyword`, el chat cambia a `HUMAN`, se refresca la intervención humana y el bot no responde en ese chat.
4. Dado un chat en modo `HUMAN`, si el dueño envía la keyword de activación configurada, por ejemplo `ok.`, el chat cambia a `AI`.
5. Dado un cliente externo que envía `ok.` o cualquier valor administrativo, no se ejecuta activación/desactivación por dueño.
6. Dado un chat bloqueado/en humano, cada mensaje del dueño que no active el bot reinicia/refresca el estado de intervención humana.
7. Dado un follow-up pendiente, el scheduler evalúa cada 12 horas y solo lo envía si el último mensaje de la conversación sigue siendo del bot y el usuario no respondió después.
8. Dado que el usuario responde a un follow-up, se cancela la ruta de seguimiento y se ejecuta el flujo inbound normal con `followup_attempts` reiniciado.
9. Dado que la conversación está fuera de la ventana de 24 horas para mensajes free-form, el sistema no envía follow-up automático libre; registra el bloqueo o deriva a humano según configuración.
10. Contactos CRM no muestra datos hardcodeados; usa las conversaciones persistidas disponibles por `/api/conversations`.
11. Las respuestas normales y de follow-up se persisten como `assistant` con timestamps y no se mezclan con mensajes `human` del dashboard/dueño.
12. La migración conceptual desde n8n queda documentada: n8n/Evolution/OpenAI/WhatsApp API oficial se reemplazan por Baileys/PostgreSQL/Redis/DeepSeek/scheduler local.

## Riesgos

- Baileys marca `fromMe` para mensajes propios; si se filtran todos esos mensajes al inicio, no se podrán detectar keywords del dueño. La implementación debe filtrar con cuidado.
- Keywords como `ok.` pueden ser comunes. Debe requerirse que vengan del dueño y preferir coincidencia exacta normalizada.
- Enviar free-form fuera de 24 horas puede causar reportes, spam o incumplimiento de políticas; el scheduler debe bloquear o escalar esos casos.
- Redis/timers pueden dejar estados colgados si el proceso cae; los locks deben tener TTL y la limpieza debe ser idempotente.
- Duplicados de Baileys pueden provocar doble respuesta; se requiere deduplicación por message id.
- El criterio de intervención del dueño necesita timestamps claros para evitar reactivaciones inesperadas; un mensaje del dueño sin `ok.` no debe reactivar.
- DeepSeek puede devolver JSON inválido; se requiere parser/fallback seguro que no envíe texto no validado en follow-ups.

## Rollback

- Desactivar el scheduler de follow-ups por variable de entorno o setting.
- Ignorar temporalmente la keyword de activación y usar solo toggle manual del dashboard.
- Revertir chats afectados a `HUMAN` desde dashboard si hubo reactivación no deseada.
- Limpiar claves Redis transitorias por prefijo de conversación sin tocar `./auth/`.
- Mantener datos persistidos de mensajes/conversaciones para auditoría; no borrar historial como rollback operativo.

## Migración desde workflows JSON a stack local

- `Webhook`/Evolution/n8n `messages.upsert` se reemplaza por listener Baileys `messages.upsert`.
- Memoria `Postgres Chat Memory`/`n8n_chat_histories` se reemplaza por tablas locales `conversations` y `messages`.
- Redis de bloqueo temporal n8n se reemplaza por Redis local con claves tipadas y TTL para debounce/locks; el estado duradero de modo debe vivir en PostgreSQL.
- Nodos OpenAI de audio/imagen/follow-up se reemplazan por llamadas DeepSeek compatibles o adaptadores locales permitidos por el stack.
- Nodos WhatsApp API oficial se reemplazan por `sock.sendMessage` de Baileys.
- Nodos schedule de n8n se reemplazan por `node-cron` o loop robusto en el proceso bot.
- Herramientas n8n como `Humano` y `Notificar humano` se representan como cambios de modo, eventos auditables y notificaciones/dashboard locales.
- El parser de partes `{ response: { part_1, part_2, part_3 } }` se mantiene como contrato local de DeepSeek para respuestas normales.

## Success criteria

- El comportamiento queda especificado sin modificar `promt.md`.
- La propuesta permite escribir design/tasks posteriores sin resolver nuevamente el alcance.
- Los criterios de aceptación cubren turno inbound, intervención automática del dueño, activación `ok.`, follow-ups de 12 horas, Contactos CRM persistido, labels/timestamps y ventana de 24 horas.
- La especificación evita dependencias prohibidas y respeta la pila Baileys + PostgreSQL + Redis + DeepSeek.

## Notas de implementación futura

- En fase design conviene precisar el esquema exacto de `settings`, campos de timestamps y claves Redis.
- En fase tasks se deben incluir pruebas primero para deduplicación, limpieza de locks, intervención del dueño, activación `ok.`, bloqueo por ventana 24h y no colisión follow-up/inbound.

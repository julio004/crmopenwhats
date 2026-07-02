# Archive: Normalización de Turnos e Interacciones de WhatsApp

## Completed Changes

1. **Gestión de Chats de Grupo**:
   - Modificación en `inbound-handler.ts` para ignorar JIDs de grupos (`g.us`) antes de cualquier persistencia o llamada a la IA.

2. **Control de Dueño (Owner Messages)**:
   - Se configuró que los mensajes del dueño (`fromMe === true`) se guarden como `role: 'human'`.
   - Si el mensaje coincide exactamente con `bot_on_keyword` (`ok.`), el chat cambia a modo `AI`.
   - Cualquier otro mensaje del dueño cambia o refresca el chat a modo `HUMAN` y detiene el procesamiento, actualizando las marcas de intervención.

3. **Follow-ups**:
   - Ajuste de los intervalos de seguimientos a un intervalo de 12 horas por defecto (preservando la ventana máxima de 24 horas de WhatsApp).

4. **DeepSeek Strict JSON**:
   - El manejador de IA ahora repara o falla adecuadamente ante respuestas de JSON no válidas sin enviar texto sin validar al cliente.

## Verification
- Validado mediante test unitarios cubriendo los filtros de grupos, persistencia de roles, palabras clave del dueño, e intervalos de seguimiento.
- Toda la suite del proyecto pasa exitosamente.

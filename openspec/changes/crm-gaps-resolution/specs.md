# Specification: CRM Gaps Resolution

## 1. Transaccionalidad Atómica en Postgres

Para evitar inconsistencias en la base de datos entre el registro principal del CRM y la tabla `audit_events`, las siguientes operaciones deben ejecutarse dentro de transacciones SQL atómicas (`BEGIN`, `COMMIT`, `ROLLBACK`):

### 1.1 `reassignContactOwner`
*   Verifica si el contacto existe en la base de datos. Si no existe, lanza un error inmediatamente sin generar registros de auditoría.
*   Si el nuevo `owner_user_id` es idéntico al actual, la operación es un no-op. Retorna el contacto sin realizar escrituras ni registrar auditoría.
*   Si hay cambios, se ejecuta en una transacción:
    1.  `UPDATE crm_contacts SET owner_user_id = $1, updated_at = $2 WHERE id = $3`
    2.  `INSERT INTO audit_events (...)` con el snapshot de cambios.

### 1.2 `setConversationCrmLink`
*   Verifica si el nuevo mapeo (`contact_id`, `account_id`) es idéntico al actual. Si es idéntico, es un no-op. Retorna el enlace sin realizar escrituras ni registrar auditoría.
*   Si hay cambios, se ejecuta en una transacción:
    1.  `INSERT INTO conversation_crm_links (...) ON CONFLICT (conversation_id) DO UPDATE ...`
    2.  `INSERT INTO audit_events (...)` con el snapshot de cambios.

### 1.3 Adaptador de Conexión Transaccional
*   Se añade el método `connect` al wrapper `crmDb` en `src/lib/repositories/runtime-crm.ts`.
*   Las funciones de base de datos de Postgres en `crm-repository.ts` verificarán si el objeto `db` provisto expone un método `connect()`. Si existe, harán checkout de un cliente individual del pool para ejecutar toda la transacción sobre la misma conexión física. Si no existe (como en los mocks/tests sencillos), ejecutarán las sentencias directamente sobre el objeto `db`.

## 2. Restricciones e Invariantes del Mock en Memoria

Para alinear el comportamiento de `InMemoryCrmRepository` con las restricciones de clave foránea e integridad de Postgres, el método `setConversationCrmLink` validará lo siguiente antes de mutar el estado:

*   **CHECK constraint (al menos uno no nulo):** Debe validarse que al menos uno de los campos `contact_id` o `account_id` no sea nulo. Si ambos son nulos, se lanza un error (`Error("CHECK constraint violation: conversation_crm_links must link to a contact or an account")`).
*   **Foreign Key constraint (contacto existente):** Si `contact_id` no es nulo, se debe verificar que el ID exista en la colección de contactos en memoria. Si no existe, se lanza un error (`Error("Foreign key constraint violation: contact does not exist")`).
*   **Foreign Key constraint (cuenta existente):** Si `account_id` no es nulo, se debe verificar que el ID exista en la colección de cuentas en memoria. Si no existe, se lanza un error (`Error("Foreign key constraint violation: account does not exist")`).

## 3. Integridad del Nombre de Conversación (Evitar Sobrescrituras)

En `src/lib/services/conversation-view.ts`, la función `enrichConversation` no debe sobrescribir el nombre original de la conversación si este ya está establecido en la tabla `conversations`.

*   **Comportamiento anterior:**
    `name: identity?.contact_name ?? conversation.name`
*   **Nuevo comportamiento:**
    `name: conversation.name || identity?.contact_name || null`
    Esto preserva el nombre asignado o modificado manualmente a nivel de conversación, utilizando el nombre de contacto de CRM únicamente como fallback cuando la conversación no posea un nombre propio.

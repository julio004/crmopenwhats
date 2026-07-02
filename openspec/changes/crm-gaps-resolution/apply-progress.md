# Apply Progress: CRM Gaps Resolution

- [x] **Phase 1: Postgres Transaccional y Cortocircuitos No-Op**
  - [x] Agregar el método `connect` a `crmDb` en `src/lib/repositories/runtime-crm.ts`.
  - [x] Implementar la lógica transaccional y los cortocircuitos no-op para `reassignContactOwner` en `src/lib/repositories/crm-repository.ts`.
  - [x] Implementar la lógica transaccional y los cortocircuitos no-op para `setConversationCrmLink` en `src/lib/repositories/crm-repository.ts`.

- [x] **Phase 2: Invariantes y Restricciones del Mock en Memoria**
  - [x] Implementar las validaciones de CHECK constraint (al menos uno no nulo) y Foreign Keys (existencia de contacto/cuenta) en `InMemoryCrmRepository.setConversationCrmLink` en `src/lib/repositories/crm-repository.ts`.
  - [x] Implementar cortocircuitos no-op en los métodos en memoria en `src/lib/repositories/crm-repository.ts`.

- [x] **Phase 3: Integridad de Nombres de Conversación**
  - [x] Agregar el helper `isDefaultName` en `src/lib/services/conversation-view.ts`.
  - [x] Actualizar la función `enrichConversation` en `src/lib/services/conversation-view.ts` para preservar nombres no-predeterminados.

- [x] **Phase 4: Cobertura de Pruebas y Verificación Final**
  - [x] Modificar y agregar casos en `tests/crm-repository.test.ts` para cubrir los errores de restricción del mock en memoria, no-ops de auditoría y comportamiento transaccional.
  - [x] Modificar `tests/conversation-view.test.ts` para asegurar que el mock utilice nombres predeterminados y validar que el nombre de conversación no se sobrescriba.
  - [x] Ejecutar el tipado estático (`npx tsc --noEmit`) y validar que no arroje errores.
  - [x] Ejecutar la suite de pruebas completa (`npm test`) y verificar que pase en un 100%.

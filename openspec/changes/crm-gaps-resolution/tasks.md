# Tasks: CRM Gaps Resolution

- [ ] **Phase 1: Postgres Transaccional y Cortocircuitos No-Op**
  - [ ] Agregar el método `connect` a `crmDb` en [runtime-crm.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/runtime-crm.ts).
  - [ ] Implementar la lógica transaccional y los cortocircuitos no-op para `reassignContactOwner` en [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts).
  - [ ] Implementar la lógica transaccional y los cortocircuitos no-op para `setConversationCrmLink` en [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts).

- [ ] **Phase 2: Invariantes y Restricciones del Mock en Memoria**
  - [ ] Implementar las validaciones de CHECK constraint (al menos uno no nulo) y Foreign Keys (existencia de contacto/cuenta) en `InMemoryCrmRepository.setConversationCrmLink` en [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts).
  - [ ] Implementar cortocircuitos no-op en los métodos en memoria en [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts).

- [ ] **Phase 3: Integridad de Nombres de Conversación**
  - [ ] Agregar el helper `isDefaultName` en [conversation-view.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/services/conversation-view.ts).
  - [ ] Actualizar la función `enrichConversation` en [conversation-view.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/services/conversation-view.ts) para preservar nombres no-predeterminados.

- [ ] **Phase 4: Cobertura de Pruebas y Verificación Final**
  - [ ] Modificar y agregar casos en [tests/crm-repository.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/crm-repository.test.ts) para cubrir los errores de restricción del mock en memoria, no-ops de auditoría y comportamiento transaccional.
  - [ ] Modificar [tests/conversation-view.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/conversation-view.test.ts) para asegurar que el mock utilice nombres predeterminados y validar que el nombre de conversación no se sobrescriba.
  - [ ] Ejecutar el tipado estático (`npx tsc --noEmit`) y validar que no arroje errores.
  - [ ] Ejecutar la suite de pruebas completa (`npm test`) y verificar que pase en un 100%.

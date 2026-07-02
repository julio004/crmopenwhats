# Tasks: CRM Deals Pipeline

- [x] **Phase 1: Capa de Datos y Repositorios**
  - [x] Modificar [db-contract.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/db-contract.ts) agregando el esquema DDL de la tabla `crm_deals` e índices.
  - [x] Crear el archivo de pruebas [tests/crm-deals-repository.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/crm-deals-repository.test.ts) (TDD: tests RED) que valide el CRUD de deals en el repositorio de CRM.
  - [x] Modificar [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts) agregando la firma y codificando la lógica en `InMemoryCrmRepository` y `PostgresCrmRepository` (TDD: tests GREEN).

- [x] **Phase 2: API del Backend**
  - [x] Crear el archivo de pruebas [tests/crm-deals-api.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/crm-deals-api.test.ts) (TDD: tests RED) que valide los endpoints `GET`, `POST`, `PATCH` y `DELETE` para deals, incluyendo control de roles de seguridad y auditorías.
  - [x] Crear las rutas de Next.js [route.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/app/api/crm/deals/route.ts) y [route.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/app/api/crm/deals/[dealId]/route.ts) codificando la lógica (TDD: tests GREEN).

- [x] **Phase 3: Frontend UI**
  - [x] Modificar [ConversationPanel.tsx](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/components/ConversationPanel.tsx) para renderizar y administrar los deals asociados al contacto en el drawer lateral de detalles.

- [x] **Phase 4: Verificación Final**
  - [x] Compilar y verificar el tipado estático (`npx tsc --noEmit` y `npm run build`).
  - [x] Ejecutar el suite completo de pruebas (`npm test`) y verificar que todas pasen sin fallas.

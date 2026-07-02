# Archive: CRM Deals Pipeline

## Completed Changes

1. **Esquema de Base de Datos**:
   - Se añadió la tabla `crm_deals` y sus respectivos índices en `DATABASE_SCHEMA_SQL` de [db-contract.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/db-contract.ts).
   - Se definieron y exportaron las interfaces `CrmDealRow` y sus tipos.

2. **Capa de Repositorio**:
   - Se extendió `CrmRepository` en [crm-repository.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/crm-repository.ts) con métodos para CRUD de Deals e historial de auditoría.
   - Se implementaron las lógicas en `InMemoryCrmRepository` y `PostgresCrmRepository`.
   - Se creó el archivo de runtime del repositorio [runtime-crm.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/lib/repositories/runtime-crm.ts).

3. **Rutas API de Backend**:
   - [route.ts](file:///C:/Edwin/Desktop/Trabajos/Bot-personal/src/app/api/crm/deals/route.ts): Endpoints para listar y crear Deals con verificación de sesión (`requireRequestRole`).
   - [route.ts](file:///C:/Edwin/Desktop/Trabajos/Bot-personal/src/app/api/crm/deals/[dealId]/route.ts): Endpoints para actualizar (PATCH) y eliminar (DELETE) Deals individuales con registro de eventos de auditoría (`crm.deal_updated` / `crm.deal_deleted`) en `audit_events`.

4. **Interfaz UI (Frontend)**:
   - Modificación en [ConversationPanel.tsx](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/src/components/ConversationPanel.tsx) agregando la sección de "Oportunidades de Venta" dentro del drawer lateral de detalles de perfil de contacto, permitiendo crear, visualizar, actualizar la etapa y eliminar oportunidades en caliente de forma reactiva en la UI.

## Verification
- Se crearon y pasaron exitosamente los tests unitarios y de integración de API en [tests/crm-deals-repository.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/crm-deals-repository.test.ts) y [tests/crm-deals-api.test.ts](file:///C:/Users/Edwin/Desktop/Trabajos/Bot-personal/tests/crm-deals-api.test.ts).
- Toda la suite del proyecto pasa exitosamente (138/138 tests exitosos en `npm test`).
- Tipado y empaquetado validado al 100% mediante `npx tsc --noEmit` y `npm run build`.

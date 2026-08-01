# demo-be-entra-external-id-blurlink

Backend NestJS. Entrypoint en `src/main.ts`, puerto `process.env.PORT ?? 3000`.

## Postman

La colección espeja 1:1 los endpoints del código. Cuando agregues, cambies o elimines un endpoint,
actualizá la colección en el mismo turno con el MCP `postman` — sin esperar a que te lo pidan.

- Colección: `30981283-279b7495-6332-4112-8aab-1773247af5d6` (para `updateCollectionRequest` usar
  el UUID sin el prefijo del owner)
- Las URLs siempre usan `{{baseUrl}}`, nunca host ni puerto hardcodeados
- Todo request lleva al menos un test de status code

Nota: `deleteCollectionRequest` no existe en el servidor MCP `minimal`. Si hace falta borrar,
verificá con `getEnabledTools`.

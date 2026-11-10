# demo-be-entra-external-id-blurlink

Backend en NestJS de una demo de **Microsoft Entra External ID**, el servicio de Microsoft para que los usuarios de una app puedan registrarse e iniciar sesión.

El frontend está en [demo-fe-entra-external-id-blurlink](https://github.com/basiliok/demo-fe-entra-external-id-blurlink).

## Requisitos

- Node.js 24
- Un tenant externo de Entra External ID con la API registrada (de ahí salen los valores del `.env`). Para configurarlo, sigue [esta guía](url).

## Cómo levantarlo

1. Instala las dependencias.

   ```bash
   npm install
   ```

2. Crea el archivo `.env` en la raíz del proyecto con estos campos.

   ```dotenv
   ENTRA_TENANT_SUBDOMAIN=your-external-tenant-subdomain
   ENTRA_TENANT_ID=your-external-tenant-id
   ENTRA_API_CLIENT_ID=your-api-app-client-id
   ENTRA_API_READ_SCOPE=Blurlinks.Read
   CORS_ORIGIN=http://localhost:5173
   ```

   Reemplaza los valores que empiezan con `your-` por los de tu tenant. Los encuentras en el [Microsoft Entra admin center](https://entra.microsoft.com/). Antes revisa, arriba a la derecha, que estés en el tenant externo de este proyecto. Si no, cámbialo con el ícono del engranaje.

   - `ENTRA_TENANT_SUBDOMAIN`: en el menú de la izquierda entra a **Entra ID** y luego a **Overview**. En la pestaña **Overview** mira **Primary domain**. El subdominio es la parte de antes de `.onmicrosoft.com`. Por ejemplo, si el dominio es `miempresa.onmicrosoft.com`, el subdominio es `miempresa`.
   - `ENTRA_TENANT_ID`: en la misma pestaña, el valor de **Tenant ID**.
   - `ENTRA_API_CLIENT_ID`: en **App registrations**, pestaña **All applications**, busca tu API y copia el valor de la columna **Application (client) ID**.
   - `ENTRA_API_READ_SCOPE`: el nombre del scope que creaste en **Expose an API**, sin el `api://...` del inicio. Si usaste el de la guía, déjalo como está.
   - `CORS_ORIGIN`: la URL del frontend, sin `/` al final. Si usas el frontend de esta demo, déjala como está.

3. Levanta la API. Queda en `http://localhost:3000`.

   ```bash
   npm run start:dev
   ```

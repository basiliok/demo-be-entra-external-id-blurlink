# demo-be-entra-external-id-blurlink

Backend NestJS 12 sobre Node 24 (ESM, Vitest, oxlint). Entrypoint en `src/main.ts`, puerto
`process.env.PORT ?? 3000`.

Es el backend de una demo de **Microsoft Entra External ID** (CIAM). El frontend vive en el repo
hermano `c:\workspace\demo-fe-entra-external-id-blurlink` (React 19 + Vite 8 + TS, puerto `5173`).

## Arquitectura objetivo

```
React SPA (5173)  ──login redirect──►  {subdominio}.ciamlogin.com   (user flow sign-up/sign-in)
       │                                        │
       │◄────── id_token + access_token ────────┘
       │
       └── Authorization: Bearer <access_token> ──►  NestJS API (3000)
                                                      valida firma vía JWKS
                                                      valida aud / iss / scp
```

Dos app registrations separadas (SPA + API), un solo user flow, Auth Code + PKCE.
El backend es **resource server puro**: no redirige, no tiene sesión, sólo valida el token.

## Postman

La colección espeja 1:1 los endpoints del código. Cuando agregues, cambies o elimines un endpoint,
actualizá la colección en el mismo turno con el MCP `postman` — sin esperar a que te lo pidan.

- Colección: `30981283-279b7495-6332-4112-8aab-1773247af5d6` (para `updateCollectionRequest` usar
  el UUID sin el prefijo del owner)
- Las URLs siempre usan `{{baseUrl}}`, nunca host ni puerto hardcodeados
- Todo request lleva al menos un test de status code

Nota: `deleteCollectionRequest` no existe en el servidor MCP `minimal`. Si hace falta borrar,
verificá con `getEnabledTools`.

---

# Plan de implementación

Se ejecuta de a poco. **Al completar un paso, marcá su checkbox en este archivo en el mismo turno.**
Orden sugerido: Portal → Backend → Frontend (la prueba con un token real se hace desde el frontend).

**Alcance:** el usuario se registra, inicia sesión y ve un mensaje de bienvenida con sus datos
(nombre para mostrar, nombre, apellido y email), que el frontend obtiene de `GET /me` con el
access token. Nada más.

## Fase 1 — Portal (entra.microsoft.com)

Requiere rol **Tenant Creator** sobre la suscripción. Todo se hace en el Entra admin center,
no en portal.azure.com.

### 1.1 Crear el tenant externo
- [x] `Entra ID > Overview > Manage tenants > Create > External`
- [x] Basics: Tenant Name, Domain Name, **Location (no se puede cambiar después)**
- [x] Add a subscription: suscripción + resource group
- [x] Create — **tarda hasta 30 min**
- [x] Anotar **Directory (tenant) ID** y **subdominio** (`xxx` de `xxx.onmicrosoft.com`)
      → tenant `Blurlink Demo`, ID `82c024ff-3df5-41f3-84f5-5209bdf0ff6e`, subdominio `blurlinkdemo`

### 1.2 Registrar la API (backend)
- [x] `App registrations > New registration` → `blurlink-demo-api`, *Single tenant only*
      (antes *Accounts in this organizational directory only*), **sin redirect URI**
- [x] `Expose an API > Application ID URI` → aceptar `api://{clientId}`
- [x] `Add a scope` → `Blurlinks.Read` — Who can consent: **Admins only** (en tenant externo los
      consumidores no consienten; el consent lo da el admin en 1.3)
- [x] `Add a scope` → `Blurlinks.ReadWrite` — idem
- [x] `Token configuration > Add optional claim > Access > idtyp` (distingue token app vs app+user)
- [x] `Token configuration > Add optional claim > Access > email, given_name, family_name`
      (datos del usuario para `GET /me`; el access token no los trae por defecto)
- [x] Verificar en `Manifest` que `accessTokenAcceptedVersion` / `requestedAccessTokenVersion` sea **2**
- [x] Anotar **Application (client) ID** de la API → `e64a2bd2-3e23-4090-9b4b-5e5ecfa9708b`

### 1.3 Registrar el SPA (frontend)
- [x] `App registrations > New registration` → `blurlink-demo-spa`, *Single tenant only*, y en el
      mismo formulario Redirect URI: platform **Single-page application (SPA)** →
      **`http://localhost:5173`**. **No habilitar implicit grant** (SPA usa auth code + PKCE)
- [x] Front-channel logout URL: **vacío** (solo sirve para single sign-out entre varias apps).
      El `postLogoutRedirectUri` de MSAL debe coincidir con un redirect URI registrado →
      `http://localhost:5173/redirect` lo cubre
- [x] `Authentication` → agregar otro redirect URI SPA: **`http://localhost:5173/redirect`** (reemplaza
      a `http://localhost:5173/redirect.html`, que se borra). MSAL v5 exige una página *redirect bridge*
      y su URI debe coincidir exacto (ruta incluida)
- [x] `Authentication` → quitar **`http://localhost:5173`**: con `postLogoutRedirectUri: '/redirect'` el logout
      también vuelve por el bridge, que te deja en `/`, así que basta una sola URI. En `logoutRedirect()` el
      bridge es opcional; en `logoutPopup()`, obligatorio (doc de MSAL en las referencias)
- [x] `Token configuration > Add optional claim > ID > login_hint` → MSAL lo manda como `logout_hint` y Entra
      cierra la sesión sin preguntar «¿De qué cuenta quiere cerrar sesión?». Solo lo traen los ID tokens
      emitidos después del cambio: hay que volver a iniciar sesión. La página «Cerró la sesión de su cuenta»
      se sigue viendo un momento: es Entra cerrando la sesión antes de volver a la app
- [x] `API permissions > Add a permission > APIs my organization uses` → `blurlink-demo-api` →
      **Delegated** → `Blurlinks.Read` + `Blurlinks.ReadWrite`
- [x] `API permissions > Add a permission > Microsoft Graph > Delegated` → `openid` + `offline_access`
- [x] **`Grant admin consent for <tenant>`** ← crítico: en tenants externos los usuarios
      consumidores no pueden consentir solos; sin esto `acquireTokenSilent` falla siempre
- [x] Anotar **client ID** del SPA → `ba599bb7-09a5-4551-a9da-7d7e897888ce`

### 1.4 Crear el user flow
- [x] `Entra ID > External Identities > User flows > New user flow` → nombre `SignUpSignIn`
- [x] Identity providers: **Email Accounts** → `Email with password` (o `Email one-time passcode`)
- [x] User attributes: `Display Name`, `Given Name`, `Surname`, `Email Address`
- [x] Create
- [x] Abrir el user flow → `Applications > Add application` → **`blurlink-demo-spa`**
      (sin esto el login tira error; una app = un solo user flow)

### 1.5 Opcionales (valor visual para la demo)
- [ ] `Company branding` — logo, colores, fondo de la página de login
- [ ] `External Identities > All identity providers` — federación Google / Facebook / Apple
- [ ] Custom attributes para pedir un dato propio en el sign-up
- [ ] MFA vía Conditional Access; control *Persistent browser session* para el prompt
      "Stay signed in?"

## Fase 2 — Backend (NestJS 12)

> Autenticación con **`@nestjs/authentication`** (oficial de Nest 12, v0.1.0, sin dependencias):
> guard global que protege **todas** las rutas (`@Public()` para abrir una) y `JwtBearerProvider`,
> que verifica tokens de un emisor externo con `jwks` + `issuer` + `audience` (RS256, llaves en
> caché 10 min, re-fetch ante `kid` desconocido). Sin Passport: `passport-azure-ad` está archivado.

- [x] Instalar `@nestjs/authentication @nestjs/config zod`
- [x] `.env` + `.env.example` (`.env` ya está en `.gitignore`):
      `ENTRA_TENANT_SUBDOMAIN`, `ENTRA_TENANT_ID`, `ENTRA_API_CLIENT_ID`, `CORS_ORIGIN=http://localhost:5173`
- [x] `ConfigModule.forRoot({ isGlobal: true })` en `src/app.module.ts`
- [x] CORS en `src/main.ts` — `origin: CORS_ORIGIN`, `allowedHeaders: ['Authorization','Content-Type']`
      (sin esto el preflight del SPA muere)
- [x] Provider async que lee el discovery doc al arrancar → `issuer` + `jwks_uri`
      (**nunca hardcodeados**, ver gotcha #1)
- [x] `src/auth/entra-jwt.auth.ts` — `extends JwtBearerProvider<Principal>`:
      - `super({ realm: 'blurlink', jwks, issuer, audience })` con `audience` = client ID de la API
        (en tokens v2 el `aud` es siempre el GUID, nunca `api://<guid>`)
      - `registry.registerProvider(this)` en el constructor
      - `validate(claims)` → `{ oid, sub, name, email, scopes: scp.split(' ') }`; `null` sin `oid`
- [x] `AuthenticationModule.forRoot({})` en `AppModule` — sin `accessToken`: la API solo verifica.
      **401** lo responde el guard global (`missing_credentials` / `invalid_token`, RFC 6750)
- [x] `@Public()` en `GET /`
- [x] Decorador `RequiredScopes` (`Reflector.createDecorator`) + `ScopesGuard` leyendo
      `request.user.scopes` → **403** si falta el scope. Uso: `@UseGuards(ScopesGuard)` en el
      controller + `@RequiredScopes([...])` en cada método; basta **uno** de los scopes listados
      (como `RequiredScope` de Microsoft.Identity.Web)
- [x] `GET /me` — requiere `Blurlinks.Read` (`@UseGuards(ScopesGuard)` en `AppController`);
      devuelve el usuario del token (`{ oid, sub, name, givenName, familyName, email, scopes }`)
      con `@CurrentUser()` para el mensaje de bienvenida del frontend
- [x] `validate()` → agregar `givenName` (`given_name`) y `familyName` (`family_name`) para que
      `GET /me` los devuelva

## Fase 3 — Frontend (React + Vite)

Repo: `c:\workspace\demo-fe-entra-external-id-blurlink`

- [x] Base como los primeros commits de `blurlink-fe`: Prettier (`singleQuote`, `trailingComma: all`,
      `printWidth: 120`, `tabWidth: 4`), `.gitattributes` (`* text=auto eol=lf`) y todo formateado
- [x] Instalar `@azure/msal-browser @azure/msal-react` → v5 (`5.27.0` / `5.7.4`; peer `react ^19.2.1`,
      el React 19.2.8 del repo es compatible)
- [x] Redirect bridge (obligatorio en MSAL v5) como ruta `/redirect` de `react-router` (v8; el paquete
      `react-router-dom` se eliminó en la v8): `src/pages/RedirectBridge.tsx` llama a
      `broadcastResponseToMainFrame()` y queda **fuera** de `<MsalProvider>`, que en `src/App.tsx` solo
      envuelve la ruta `/` (como el `react-router-sample` oficial de MSAL)
- [x] `.env` + `.env.example` (`.env` en `.gitignore`): `VITE_ENTRA_CLIENT_ID`,
      `VITE_ENTRA_AUTHORITY=https://{subdominio}.ciamlogin.com/{tenantId}`
- [x] `src/config/msal.ts` (como `src/config/axios.ts` de `blurlink-fe`) — `msalInstance` (authority
      **con** tenant id, ver gotcha #13; `redirectUri: '/redirect'`, `postLogoutRedirectUri: '/redirect'`,
      `cacheLocation: 'sessionStorage'`), `loginRequest` (scopes vacío) y `addEventCallback` en
      `LOGIN_SUCCESS` → `setActiveAccount` (en v5 el payload es `AccountInfo`)
- [x] `src/main.tsx` — `await msalInstance.initialize()` antes de renderizar; `<MsalProvider>` va en
      `src/App.tsx`, solo en la ruta `/`
- [x] Componentes: `SignInButton` (`loginRedirect`), `SignUpButton`
      (`loginRedirect({ prompt: PromptValue.CREATE })`), `SignOutButton` (`logoutRedirect`),
      `<AuthenticatedTemplate>` / `<UnauthenticatedTemplate>`
- [x] `SignOutButton` → `logoutRedirect({ account: activeAccount })` con `instance.getActiveAccount()`: MSAL
      solo saca el `logout_hint` del claim `login_hint` si recibe la cuenta (paso 1.3)
- [x] `.env`: `VITE_API_BASE_URL=http://localhost:3000` y
      `VITE_API_SCOPE_READ=api://<api client id>/Blurlinks.Read`; `apiRequest` en `src/config/msal.ts`.
      Las variables se validan con Zod al arrancar (`src/config/env.ts`)
- [x] `src/hooks/useApiFetch.ts` — espera `inProgress === InteractionStatus.None`, `acquireTokenSilent`
      con fallback a `acquireTokenRedirect` ante `InteractionRequiredAuthError`, `Authorization: Bearer`
      en el fetch y la respuesta validada con un schema de Zod (`src/schemas/user.schema.ts`)
- [x] Mensaje de bienvenida (`WelcomeMessage`): `GET /me` con el access token → «¡Bienvenido, {name}!»
      y debajo los datos del usuario (nombre, apellido y email)
- [x] `vite.config.ts` → `server: { port: 5173, strictPort: true }` para que el redirect URI
      nunca se desalinee

---

## Gotchas (en orden de probabilidad)

1. **El `iss` del token no matchea lo hardcodeado.** Hay inconsistencia documentada: a veces
   `https://{tenantId}.ciamlogin.com/{tenantId}/v2.0`, a veces `login.microsoftonline.com`.
   → Leer `issuer` y `jwks_uri` del discovery doc:
   `https://{subdominio}.ciamlogin.com/{tenantId}/v2.0/.well-known/openid-configuration`
   Discovery doc de este tenant: `issuer` usa el **tenant ID como subdominio**
   (`https://82c024ff-….ciamlogin.com/82c024ff-…/v2.0`), mientras que `jwks_uri` usa `blurlinkdemo`
   (`https://blurlinkdemo.ciamlogin.com/82c024ff-…/discovery/v2.0/keys`)
2. **Redirect URI 3000 vs 5173.** Los tutoriales de Microsoft asumen `create-react-app` en 3000;
   Vite corre en 5173. Registrar 5173.
3. **Falta el admin consent** (paso 1.3) → `acquireTokenSilent` falla siempre en tenant externo.
4. **Se pide token con `openid profile` y el backend rechaza el `aud`.** Para llamar a la API hay
   que pedir `api://{apiClientId}/Blurlinks.Read`, no scopes OIDC. Un token con audiencia Graph
   nunca valida.
5. **El SPA no aparece en el login / error de user flow** → falta agregar la app al user flow (1.4).
6. **CORS preflight 404** → `enableCors` con `Authorization` en `allowedHeaders`.
7. **`uninitialized_public_client_application`** → falta `await instance.initialize()`.
8. **`IDX10501` / "signature key not found"** → JWKS endpoint incorrecto; debe ser el de
   `ciamlogin.com`, no el de `login.microsoftonline.com`.
9. **Token v1 vs v2** → verificar `accessTokenAcceptedVersion: 2` en el manifest de la API.
10. **`AADSTS50011` / `redirect_uri_mismatch` con MSAL v5** → `redirectUri` apunta al redirect bridge
    (`/redirect`) y esa URI exacta debe estar registrada en el SPA (paso 1.3).
11. **`LOGIN_SUCCESS` en MSAL v5** → el payload es `AccountInfo`, no `AuthenticationResult`. Castearlo a
    `AuthenticationResult` (como los tutoriales viejos) deja `account` en `undefined` sin error.
12. **Errores de MSAL v5** → `error.message` es un link a la doc; para identificarlos usar `error.errorCode`.
13. **Clic en "Iniciar sesión" / "Registrarse" y no pasa nada (`endpoints_resolution_error` en consola)**
    → desde MSAL 5.10 se valida que el `issuer` del discovery doc coincida con la authority. Con
    `https://{subdominio}.ciamlogin.com/` (sin tenant ID, como el tutorial oficial) MSAL la convierte a
    `…/{subdominio}.onmicrosoft.com`, pero el `issuer` de este tenant usa el GUID
    (`https://82c024ff-….ciamlogin.com/…`, mismo caso que el gotcha #1) → `issuer_validation_failed`,
    envuelto como `endpoints_resolution_error`. → Authority **con** tenant ID:
    `https://blurlinkdemo.ciamlogin.com/82c024ff-3df5-41f3-84f5-5209bdf0ff6e`. Alternativa de la doc de
    MSAL: authority por nombre + `knownAuthorities` con `blurlinkdemo.ciamlogin.com` y
    `82c024ff-….ciamlogin.com`

---

## Documentación de referencia

### Tenant y configuración base
- [Quickstart: crear un tenant externo](https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup) — pasos del portal, prerequisitos y roles
- [How-to: crear tenant externo + obtener detalles del tenant](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-create-external-tenant-portal) — de acá salen subdominio y tenant ID
- [Tenant configurations: workforce vs external](https://learn.microsoft.com/en-us/entra/external-id/tenant-configurations)
- [Elegir enfoque de autenticación (browser-delegated vs native)](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-choose-authentication-approach)
- [Pricing de External ID](https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing) — primeros 50.000 MAU sin costo

### User flows
- [Crear user flow de sign-up/sign-in](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers)
- [Agregar la aplicación al user flow](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-add-application)
- [Definir atributos personalizados](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-define-custom-attributes)
- [Federación con Google](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-google-federation-customers) · [Facebook](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-facebook-federation-customers)
- [Branding personalizado](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-customize-branding-customers) · [Custom URL domain](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-custom-url-domain)

### Frontend / React + MSAL
- [Tutorial: preparar un SPA React para autenticación](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-single-page-app-react-prepare-app) — tiene tab de *External tenant* con el `authConfig.js` completo
- [Tutorial: preparar el tenant externo para un SPA React](https://learn.microsoft.com/en-us/entra/external-id/customers/tutorial-single-page-app-react-sign-in-prepare-tenant)
- [Configuración de MSAL.js (referencia completa)](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md)
- [Guía de migración MSAL React](https://learn.microsoft.com/en-us/entra/msal/javascript/react/migration-guide)
- [Migrar MSAL Browser v4 → v5](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/v4-migration) — redirect bridge (COOP), payload de `LOGIN_SUCCESS`, opciones removidas
- [Migrar MSAL React v3 → v5](https://learn.microsoft.com/en-us/entra/msal/javascript/react/migration-guide-v4-v5)
- [Redirect bridge por framework (Vite)](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge#vite)
- [MSAL: logout y el redirect bridge](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/redirect-bridge.md#logout-and-the-redirect-bridge) — `logoutPopup()` exige el bridge como `postLogoutRedirectUri`; en `logoutRedirect()` es opcional y, si está, te devuelve a la raíz de la app. Learn todavía no tiene esta sección
- [Prompt behavior (`create` = sign-up)](https://learn.microsoft.com/en-us/entra/identity-platform/msal-js-prompt-behavior)
- [MSAL: authority e issuer validation en CIAM](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/authority.md) · [issue #8592](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/8592) — origen del gotcha #13

### Backend / proteger la API
- [NestJS: Authentication (`@nestjs/authentication`)](https://docs.nestjs.com/security/authentication) — guard global, `@Public()`, `JwtBearerProvider` (hint de emisor externo con `jwks`), errores 401
- [NestJS: Schema-based validation](https://github.com/nestjs/docs.nestjs.com/blob/master/content/application/validation.md) — `StandardSchemaValidationPipe` + Zod
- [Preparar el tenant externo para llamar a una API](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-web-app-node-sign-in-call-api-prepare-tenant) — grant de permisos, admin consent, formato `api://{clientId}/{scope}`
- [Exponer scopes en una web API protegida](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-expose-scopes)
- [Access tokens en Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens) — claims, validación, versiones
- [Configurar optional claims (`idtyp`)](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims)
- [Sign-out request (`logout_hint`)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc#send-a-sign-out-request) — con el claim `login_hint` como `logout_hint`, Entra no muestra el selector de cuentas al cerrar sesión
- [Troubleshoot: errores de validación de firma](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/troubleshooting-signature-validation-errors) — formato de issuer y JWKS de `ciamlogin.com`
- [`passport-azure-ad` (archivado — NO usar)](https://github.com/AzureAD/passport-azure-ad)

### Samples
- [Azure-Samples / ms-identity-ciam-javascript-tutorial](https://github.com/Azure-Samples/ms-identity-ciam-javascript-tutorial) — `2-Authorization/1-call-api-react` es prácticamente este caso de uso
- [Sample: React SPA llamando API protegida (External ID)](https://learn.microsoft.com/en-us/samples/azure-samples/ms-identity-ciam-javascript-tutorial/ms-identity-ciam-javascript-tutorial-2-call-api-react/)
- [MSAL React / react-router-sample](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples/msal-react-samples/react-router-sample) — redirect bridge como ruta `/redirect` (`pages/Redirect.jsx`) fuera de `MsalProvider`

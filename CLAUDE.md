# demo-be-entra-external-id-blurlink

Backend NestJS. Entrypoint en `src/main.ts`, puerto `process.env.PORT ?? 3000`.

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
Orden sugerido: Portal → Backend (probando con token pegado a mano en Postman) → Frontend.

## Fase 1 — Portal (entra.microsoft.com)

Requiere rol **Tenant Creator** sobre la suscripción. Todo se hace en el Entra admin center,
no en portal.azure.com.

### 1.1 Crear el tenant externo
- [ ] `Entra ID > Overview > Manage tenants > Create > External`
- [ ] Basics: Tenant Name, Domain Name, **Location (no se puede cambiar después)**
- [ ] Add a subscription: suscripción + resource group
- [ ] Create — **tarda hasta 30 min**
- [ ] Anotar **Directory (tenant) ID** y **subdominio** (`xxx` de `xxx.onmicrosoft.com`)

### 1.2 Registrar la API (backend)
- [ ] `App registrations > New registration` → `blurlink-api`, *Accounts in this organizational
      directory only*, **sin redirect URI**
- [ ] `Expose an API > Application ID URI` → aceptar `api://{clientId}`
- [ ] `Add a scope` → `Blurlinks.Read` — Who can consent: **Admins and users**
- [ ] `Add a scope` → `Blurlinks.ReadWrite` — idem
- [ ] `Token configuration > Add optional claim > Access > idtyp` (distingue token app vs app+user)
- [ ] Verificar en `Manifest` que `accessTokenAcceptedVersion` / `requestedAccessTokenVersion` sea **2**
- [ ] Anotar **Application (client) ID** de la API

### 1.3 Registrar el SPA (frontend)
- [ ] `App registrations > New registration` → `blurlink-spa`, mismo tipo de cuenta
- [ ] `Authentication > Add a platform > Single-page application` → Redirect URI
      **`http://localhost:5173`**. **No habilitar implicit flow** (SPA usa auth code + PKCE)
- [ ] Front-channel logout / postLogoutRedirectUri → `http://localhost:5173`
- [ ] `API permissions > Add a permission > APIs my organization uses` → `blurlink-api` →
      **Delegated** → `Blurlinks.Read` + `Blurlinks.ReadWrite`
- [ ] **`Grant admin consent for <tenant>`** ← crítico: en tenants externos los usuarios
      consumidores no pueden consentir solos; sin esto `acquireTokenSilent` falla siempre
- [ ] Anotar **client ID** del SPA

### 1.4 Crear el user flow
- [ ] `Entra ID > External Identities > User flows > New user flow` → nombre `SignUpSignIn`
- [ ] Identity providers: **Email Accounts** → `Email with password` (o `Email one-time passcode`)
- [ ] User attributes: `Display Name`, `Given Name`, `Surname`, `Email Address`
- [ ] Create
- [ ] Abrir el user flow → `Applications > Add application` → **`blurlink-spa`**
      (sin esto el login tira error; una app = un solo user flow)

### 1.5 Opcionales (valor visual para la demo)
- [ ] `Company branding` — logo, colores, fondo de la página de login
- [ ] `External Identities > All identity providers` — federación Google / Facebook / Apple
- [ ] Custom attributes para pedir un dato propio en el sign-up
- [ ] MFA vía Conditional Access; control *Persistent browser session* para el prompt
      "Stay signed in?"

## Fase 2 — Backend (NestJS)

> **`passport-azure-ad` está deprecado y archivado por Microsoft. No usarlo.**
> Reemplazo: `passport-jwt` + `jwks-rsa`, o `jose` directo (más liviano, sin Passport).

- [ ] Instalar `@nestjs/config @nestjs/passport passport passport-jwt jwks-rsa` +
      `-D @types/passport-jwt`
- [ ] `.env` + `.env.example` (y `.env` en `.gitignore`):
      `ENTRA_TENANT_SUBDOMAIN`, `ENTRA_TENANT_ID`, `ENTRA_API_CLIENT_ID`,
      `ENTRA_AUDIENCE=api://<api client id>`, `CORS_ORIGIN=http://localhost:5173`
- [ ] `ConfigModule.forRoot({ isGlobal: true })` en `src/app.module.ts`
- [ ] CORS en `src/main.ts` — `origin: CORS_ORIGIN`, `allowedHeaders: ['Authorization','Content-Type']`
      (sin esto el preflight del SPA muere)
- [ ] `src/auth/jwt.strategy.ts`:
      - `secretOrKeyProvider: passportJwtSecret({ jwksUri, cache: true, rateLimit: true })`
        con `jwksUri = https://{subdominio}.ciamlogin.com/{tenantId}/discovery/v2.0/keys`
      - `algorithms: ['RS256']`, `audience` (probar `<guid>` y `api://<guid>`)
      - `issuer` **leído del discovery doc, nunca hardcodeado** (ver gotcha #1)
      - `validate()` → `{ oid, sub, name, email, scopes: payload.scp?.split(' ') }`
- [ ] `src/auth/jwt-auth.guard.ts` (`AuthGuard('jwt')`)
- [ ] `src/auth/scopes.guard.ts` + decorador `@Scopes('Blurlinks.Read')` leyendo el claim `scp`.
      **401** si el token es inválido, **403** si falta el scope
- [ ] `ValidationPipe` global + DTOs
- [ ] Endpoints de demo:
      - [ ] `GET /` — público, sin guard (health check, ya existe)
      - [ ] `GET /me` — protegido, devuelve los claims decodificados
      - [ ] `GET /blurlinks` — requiere `Blurlinks.Read`
      - [ ] `POST /blurlinks` — requiere `Blurlinks.ReadWrite`
      - [ ] `GET /admin` (opcional) — requiere app role, para mostrar 403 en vivo
- [ ] Store en memoria (`Map`) filtrado por `oid` → demuestra aislamiento de datos por identidad
- [ ] Sincronizar Postman: variable `{{accessToken}}`, header `Authorization: Bearer {{accessToken}}`,
      y tests de **200** (token válido), **401** (sin token), **403** (scope insuficiente)

## Fase 3 — Frontend (React + Vite)

Repo: `c:\workspace\demo-fe-entra-external-id-blurlink`

- [ ] Instalar `@azure/msal-browser @azure/msal-react`
      (peer: `react ^19.2.1` — el React 19.2.8 del repo es compatible)
- [ ] `.env` con prefijo `VITE_`: `VITE_ENTRA_CLIENT_ID`,
      `VITE_ENTRA_AUTHORITY=https://{subdominio}.ciamlogin.com/`,
      `VITE_API_BASE_URL=http://localhost:3000`,
      `VITE_API_SCOPE_READ=api://<api client id>/Blurlinks.Read`,
      `VITE_API_SCOPE_WRITE=api://<api client id>/Blurlinks.ReadWrite`
- [ ] `src/authConfig.ts` — `msalConfig` (authority **sin** tenant id, `cacheLocation: 'sessionStorage'`),
      `loginRequest` (scopes vacío) y `apiRequest` (scopes de la API)
- [ ] `src/main.tsx` — instanciar `PublicClientApplication` **fuera** del árbol de componentes,
      **`await instance.initialize()` antes de renderizar** (obligatorio desde MSAL v3),
      `addEventCallback` en `LOGIN_SUCCESS` → `setActiveAccount`, envolver en `<MsalProvider>`
- [ ] Componentes: `SignInButton` (`loginRedirect`), `SignUpButton`
      (`loginRedirect({ prompt: 'create' })`), `SignOutButton` (`logoutRedirect`),
      `<AuthenticatedTemplate>` / `<UnauthenticatedTemplate>`
- [ ] Panel que muestre `activeAccount.idTokenClaims` en JSON
- [ ] `src/hooks/useApiFetch.ts` — `acquireTokenSilent` con fallback a `acquireTokenRedirect`
      ante `InteractionRequiredAuthError`, y `Authorization: Bearer` en el fetch
- [ ] Pantallas: lista de blurlinks (GET), form de alta (POST → fuerza scope de escritura),
      botón "llamar sin token" que muestre el 401, visor del access token decodificado
      (`aud`, `iss`, `scp`, `oid`)
- [ ] Opcional: `react-router` + `MsalAuthenticationTemplate` para rutas protegidas
- [ ] `vite.config.ts` → `server: { port: 5173, strictPort: true }` para que el redirect URI
      nunca se desalinee

---

## Gotchas (en orden de probabilidad)

1. **El `iss` del token no matchea lo hardcodeado.** Hay inconsistencia documentada: a veces
   `https://{tenantId}.ciamlogin.com/{tenantId}/v2.0`, a veces `login.microsoftonline.com`.
   → Leer `issuer` y `jwks_uri` del discovery doc:
   `https://{subdominio}.ciamlogin.com/{tenantId}/v2.0/.well-known/openid-configuration`
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

### Backend / proteger la API
- [Preparar el tenant externo para llamar a una API](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-web-app-node-sign-in-call-api-prepare-tenant) — grant de permisos, admin consent, formato `api://{clientId}/{scope}`
- [Exponer scopes en una web API protegida](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-expose-scopes)
- [Access tokens en Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens) — claims, validación, versiones
- [Configurar optional claims (`idtyp`)](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims)
- [Troubleshoot: errores de validación de firma](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/troubleshooting-signature-validation-errors) — formato de issuer y JWKS de `ciamlogin.com`
- [`passport-azure-ad` (archivado — NO usar)](https://github.com/AzureAD/passport-azure-ad)

### Samples
- [Azure-Samples / ms-identity-ciam-javascript-tutorial](https://github.com/Azure-Samples/ms-identity-ciam-javascript-tutorial) — `2-Authorization/1-call-api-react` es prácticamente este caso de uso
- [Sample: React SPA llamando API protegida (External ID)](https://learn.microsoft.com/en-us/samples/azure-samples/ms-identity-ciam-javascript-tutorial/ms-identity-ciam-javascript-tutorial-2-call-api-react/)

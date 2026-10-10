import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const ENTRA_OIDC = Symbol('ENTRA_OIDC');

const entraOidcMetadataSchema = z.object({
  issuer: z.url(),
  jwks_uri: z.url(),
});

export type EntraOidcMetadata = z.infer<typeof entraOidcMetadataSchema>;

/** Receta para Nest: obtiene `{ issuer, jwks_uri }` y lo guarda en `ENTRA_OIDC`. */
export const entraOidcProvider: FactoryProvider<Promise<EntraOidcMetadata>> = {
  provide: ENTRA_OIDC, // con qué etiqueta se guarda el resultado
  inject: [ConfigService], // qué necesita la función
  useFactory: async (config: ConfigService) => {
    // Nest la ejecuta una vez al arrancar y guarda lo que devuelve bajo ENTRA_OIDC
    const subdomain = config.getOrThrow<string>('ENTRA_TENANT_SUBDOMAIN');
    const tenantId = config.getOrThrow<string>('ENTRA_TENANT_ID');
    const url = `https://${subdomain}.ciamlogin.com/${tenantId}/v2.0/.well-known/openid-configuration`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Entra discovery document request failed with HTTP ${response.status}: ${url}`,
      );
    }

    const discoveryDocument = await response.json();
    const metadata: EntraOidcMetadata =
      entraOidcMetadataSchema.parse(discoveryDocument);
    return metadata;
  },
};

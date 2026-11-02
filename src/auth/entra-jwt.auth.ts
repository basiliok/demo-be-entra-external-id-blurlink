import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { ENTRA_OIDC, type EntraOidcMetadata } from './entra-oidc.provider.js';
import type { Principal } from './principal.js';

const stringClaim = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** No se llama directo: el guard global la usa en cada petición protegida. (get, post, put, delete) */
@Injectable()
export class EntraJwtAuth extends JwtBearerProvider<Principal> {
  constructor(
    @Inject(ENTRA_OIDC) oidc: EntraOidcMetadata, // { issuer, jwks_uri } del provider EntraOidcProvider
    config: ConfigService, // para leer el .env
    registry: AuthenticationRegistry, // la lista de providers del guard
  ) {
    super({
      realm: 'blurlink',
      jwks: oidc.jwks_uri,
      issuer: oidc.issuer,
      audience: config.getOrThrow<string>('ENTRA_API_CLIENT_ID'),
    });
    registry.registerProvider(this);
  }

  // Lo llama la clase padre con el token ya verificado; devolver null lo rechaza (401).
  validate(claims: JwtClaims): Principal | null {
    if (typeof claims.oid !== 'string') {
      return null;
    }
    return {
      oid: claims.oid,
      sub: claims.sub,
      name: stringClaim(claims.name),
      email: stringClaim(claims.email),
      scopes: typeof claims.scp === 'string' ? claims.scp.split(' ') : [],
    };
  }
}

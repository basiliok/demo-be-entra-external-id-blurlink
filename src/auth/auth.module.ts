import { Module } from '@nestjs/common';
import { EntraJwtAuth } from './entra-jwt.auth.js';
import { entraOidcProvider } from './entra-oidc.provider.js';

@Module({
  providers: [entraOidcProvider, EntraJwtAuth],
})
export class AuthModule {}

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Principal } from './principal.js';

// createDecorator solo fabrica decoradores que guardan un dato (no aplica el decorador en si)
export const RequiredScopesFromEnv = Reflector.createDecorator<string[]>();

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // requiredScopes = ['Blurlinks.Read']
    const requiredScopes = this.getScopesRequiredByEndpoint(context);
    if (requiredScopes.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: Principal | null }>();
    const granted = user?.scopes ?? [];
    if (requiredScopes.some((scope) => granted.includes(scope))) {
      return true;
    }
    throw new ForbiddenException(
      `Insufficient scope. Required one of: ${requiredScopes.join(', ')}`,
    );
  }

  private getScopesRequiredByEndpoint(context: ExecutionContext): string[] {
    // Variables del .env que guardan los scopes requeridos: ['ENTRA_API_READ_SCOPE']
    const scopeEnvVariableNames = this.reflector.getAllAndOverride(
      RequiredScopesFromEnv,
      [context.getHandler(), context.getClass()],
    );
    if (scopeEnvVariableNames === undefined) {
      return [];
    }

    return scopeEnvVariableNames.map((scopeEnvVariableName) =>
      this.configService.getOrThrow<string>(scopeEnvVariableName),
    );
  }
}

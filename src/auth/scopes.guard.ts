import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Principal } from './principal.js';

// createDecorator solo fabrica decoradores que guardan un dato (no aplica el decorador en si)
export const RequiredScopes = Reflector.createDecorator<string[]>();

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los scopes requeridos del decorador: ['Blurlinks.Read', 'Blurlinks.ReadWrite']
    const requiredScopes = this.reflector.getAllAndOverride(RequiredScopes, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredScopes?.length) {
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
}

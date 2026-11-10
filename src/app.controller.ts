import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { AppService } from './app.service.js';
import type { Principal } from './auth/principal.js';
import { RequiredScopesFromEnv, ScopesGuard } from './auth/scopes.guard.js';

@Controller()
@UseGuards(ScopesGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public() // Ruta accesible sin token.
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @RequiredScopesFromEnv(['ENTRA_API_READ_SCOPE'])
  @Get('me')
  getCurrentUser(@CurrentUser() currentUser: Principal): Principal {
    return currentUser;
  }
}

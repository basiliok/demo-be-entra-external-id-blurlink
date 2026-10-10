import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public() // Ruta accesible sin token.
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

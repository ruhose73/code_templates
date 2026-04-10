import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { GracefulShutdownService } from './shutdown.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly gracefulShutdownService: GracefulShutdownService) {}

  /**
   * Healthckeck
   */
  @Get()
  async getHealth(@Res() res: FastifyReply) {
    if (this.gracefulShutdownService.isShutdownInProgress()) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).send('Shutting down');
    } else {
      res.status(HttpStatus.OK).send('OK');
    }
  }
}

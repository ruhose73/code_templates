import * as dotenv from 'dotenv';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from './logger/logger.service';
import { HttpExceptionFilter } from './common/response/http-exception.filter';
import { ResponseInterceptor } from './common/response/response.interceptor';

dotenv.config();

export const bootstrap = async () => {
  const logger = new AppLoggerService();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger });

  app.enableShutdownHooks();
  app.enableCors();

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  const PORT = configService.getOrThrow('PORT');

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);

  await app.listen(PORT, '0.0.0.0');
  logger.log(`Application is running on: http://localhost:${PORT}`, AppModule.name);
  logger.log(`Documentation is running on: http://localhost:${PORT}/docs`, AppModule.name);
};

bootstrap();

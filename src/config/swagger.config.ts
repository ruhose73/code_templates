import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Code Template Service API')
  .setDescription('API документация для сервиса шаблонов')
  .setVersion('1.0')
  .build();

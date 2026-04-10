import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const isProd = process.env.NODE_ENV === 'prod';

const entities = isProd ? [path.join(__dirname, '../../src/entities/**/*.entity.js')] : ['src/entities/**/*{.ts,.js}'];
const migrations = isProd ? [path.join(__dirname, '../../src/migrations/*{.ts,.js}')] : ['src/migrations/*{.ts,.js}'];

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  entities,
  migrations,
});

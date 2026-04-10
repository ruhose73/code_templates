import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  // App
  @IsOptional()
  @IsIn(['dev', 'prod'])
  declare NODE_ENV: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  declare PORT: number;

  // PostgreSQL
  @IsString()
  declare DB_HOST: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  declare DB_PORT: number;

  @IsString()
  declare DB_USERNAME: string;

  @IsString()
  declare DB_PASSWORD: string;

  @IsString()
  declare DB_DATABASE: string;

  @IsOptional()
  @IsBooleanString()
  declare DB_LOGGING: string;

  // ClickHouse
  @IsOptional()
  @IsUrl({ require_tld: false })
  declare CLICKHOUSE_URL: string;

  @IsOptional()
  @IsString()
  declare CLICKHOUSE_DATABASE: string;

  @IsOptional()
  @IsString()
  declare CLICKHOUSE_USERNAME: string;

  @IsOptional()
  @IsString()
  declare CLICKHOUSE_PASSWORD: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare CLICKHOUSE_REQUEST_TIMEOUT: number;

  // Redis
  @IsOptional()
  @IsString()
  declare REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  declare REDIS_PORT: number;

  @IsOptional()
  @IsString()
  declare REDIS_PASSWORD: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare REDIS_DB: number;

  // AMQP
  @IsOptional()
  @IsIn(['amqp', 'amqps'])
  declare AMQP_PROTOCOL: string;

  @IsOptional()
  @IsString()
  declare AMQP_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  declare AMQP_PORT: number;

  @IsOptional()
  @IsString()
  declare AMQP_USERNAME: string;

  @IsOptional()
  @IsString()
  declare AMQP_PASSWORD: string;

  @IsOptional()
  @IsString()
  declare AMQP_VHOST: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare AMQP_HEARTBEAT: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare AMQP_RECONNECT_DELAY: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare AMQP_MAX_RECONNECT_ATTEMPTS: number;

  // Kafka
  @IsOptional()
  @IsString()
  declare KAFKA_BROKERS: string;

  @IsOptional()
  @IsString()
  declare KAFKA_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  declare KAFKA_GROUP_ID: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare KAFKA_CONNECTION_TIMEOUT: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare KAFKA_REQUEST_TIMEOUT: number;

  // MongoDB
  @IsOptional()
  @IsUrl({ require_tld: false })
  declare MONGO_URI: string;

  @IsOptional()
  @IsString()
  declare MONGO_DATABASE: string;

  // JWT
  @IsString()
  declare JWT_SECRET: string;

  // Auth
  @IsOptional()
  @IsInt()
  @Min(1)
  declare BCRYPT_ROUNDS: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare REFRESH_TOKEN_BYTES: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare REFRESH_TOKEN_DAYS: number;
}

/**
 * Validate environment variables
 */
export const envValidate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
};

# Claude Code — Project Rules

## Commands (allowed without permission)

- `npm run lint:fix` — the only command allowed to run automatically

## Forbidden commands (require explicit permission)

- `npm`, `npx`, `yarn` (except `lint:fix`)
- `typeorm`, `knex`, `prisma`, `sequelize`
- `kubectl`, `helm`, `terraform`
- `docker`, `docker-compose`
- `git`
- Any scripts from `scripts/`

## Read-only files and folders (do not modify without permission)

- `src/config` — environment configs
- `src/db/migrations` — migrations are created manually by the developer
- `.env`, `.env.*`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.build.json`
- `.eslintignore`, `.eslintrc.json`
- `.gitattributes`, `.gitignore`
- `.prettierrc`
- `nest-cli.json`
- `commitlint.config.js`

## Working zone (read and modify allowed)

- `src/` (except read-only exceptions above)
- `test/`, `tests/`
- `*.spec.ts`, `*.test.ts`
- `*.md`

## Indexing and file access

- Do not proactively index or read files without explicit instruction
- Only read files that are directly mentioned in the current task
- Do not traverse the entire project structure unless asked
- Do not read files outside the working zone
- If additional context is needed — ask which files to read, do not search independently

## Do not index

- `dist/`
- `build/`
- Any build output folders

## Tech stack

- **Runtime:** Node.js 20.x, TypeScript 5.x
- **Framework:** NestJS (Fastify core)
- **ORM:** TypeORM
- **Testing:** Jest + Supertest
- **Linting:** ESLint + Prettier

## ESLint

Always read `.eslintrc.json`, `.prettierrc`, `.eslintignore` before writing code.

## Code style

- **Naming:** camelCase for variables/functions, PascalCase for classes/types/interfaces
- **DTO over interfaces:** use DTO with `class-validator`, `class-transformer` and `@nestjs/swagger`
- **DTO suffix:** `Dto` → `UserRepositoryDto`, not `UserRepository`
- **Enums:** SCREAMING_SNAKE_CASE for values
- **Files:** kebab-case → `user-repository.ts`
- **Exports:** named exports everywhere, default exports only for configs

## Async/Await

Use `Promise.all` for parallel independent requests:
\`\`\`typescript
const [user, permissions] = await Promise.all([
  this.userRepo.findById(id),
  this.permissionsRepo.findByUserId(id),
]);
\`\`\`
Never use `await` inside `forEach` — use `Promise.all` + `map` instead.

## Testing conventions

- Unit tests: `*.spec.ts` next to the source file
- Integration tests: `test/integration/`
- Mocks: only via `jest.mock()` or factories in `test/factories/`
- No real network requests in tests
- Coverage: minimum 80% for `src/modules/`

## Project architecture

### Structure

A NestJS service on Fastify. Below is a description of all the folders and files in `src/`, with a brief explanation of the purpose of each.

```
src/
├── main.ts                   # Entry point: creates a Fastify application, integrates Swagger and ValidationPipe, and runs it on PORT
├── app.module.ts             # Root module: registers ConfigModule, TypeORM and HealthModule
├── env.validation.ts         # Validation of required environment variables on startup using class-validator
│
├── config/                   # Configuration files (read-only – do not modify without good reason)
│   ├── postgresql.config.ts                # TypeORM: PostgreSQL, autoLoadEntities, synchronize: false, DB_LOGGING support
│   ├── clickhouse.config.ts                # ClickHouse connection parameters (url, database, username, password, requestTimeout)
│   ├── redis.config.ts                     # Redis connection parameters (host, port, password, database, retryStrategy)
│   ├── amqp.config.ts                      # RabbitMQ connection settings (host, port, vhost, heartbeat, retryStrategy)
│   ├── kafka.config.ts                     # Kafka connection parameters (brokers, clientId, groupId, connectionTimeout, requestTimeout)
│   ├── mongo.config.ts                     # MongoDB connection parameters (uri, dbName)
│   ├── swagger.config.ts                   # Title, version and description of the Swagger documentation
│   └── postgresql-migration.config.ts      # DataSource for running migrations; resolves paths for dev (ts) and prod (js) via NODE_ENV
│
├── clients/                  # Low-level clients for external services
│   ├── postgresql/
│   │   ├── postgresql.module.ts  # Exposes the TypeORM DataSource via the POSTGRESQL_DATA_SOURCE token (wraps the global TypeOrmModule connection)
│   │   └── postgresql.md         # PostgresqlModule documentation: injection, raw queries, transactions, QueryRunner
│   │   └── entities/             # TypeORM entities
│   │   │   ├── user.entity.ts            # id,  password, email
│   │   │   ├── balance.entity.ts         # id, balance, bonusBalance, userId FK
│   │   │   ├── order.entity.ts           # id, userId FK, balanceId FK, totalPrice, status (enum: PENDING|PAID|FAILED)
│   │   │   ├── order-item.entity.ts      # id, orderId FK, productId (MongoDB ref), quantity, price
│   ├── clickhouse/
│   │   ├── clickhouse.module.ts  # Provides the @clickhouse/client instance via the CLICKHOUSE_CLIENT token; exports ClickhouseService
│   │   ├── clickhouse.service.ts # Methods: query, queryOne, insert (batch), exec (DDL/mutations), ping; graceful shutdown via beforeApplicationShutdown
│   │   └── clickhouse.md         # ClickhouseService documentation: methods, configuration, ClickHouse-specific nuances, lifecycle
│   ├── redis/
│   │   ├── redis.module.ts   # Provides the ioredis client via the REDIS_CLIENT token; exports RedisService
│   │   ├── redis.service.ts  # Typed data structures: strings, hashes, lists, sets, sorted sets, streams, bitmaps
│   │   └── redis.md          # RedisService documentation: methods, configuration, lifecycle
│   ├── amqp/
│   │   ├── amqp.module.ts    # Provides the configuration via the AMQP_CONFIG token; exports AmqpService
│   │   ├── amqp.service.ts   # Methods: assertExchange, assertQueue, bindQueue, publish, consume, get, ack, nack; retry upon connection restoration
│   │   └── amqp.md           # AmqpService documentation: topology, publishing, consumers, graceful shutdown
│   ├── kafka/
│   │   ├── kafka.module.ts   # Provides the configuration via the KAFKA_CONFIG token; exports KafkaService
│   │   ├── kafka.service.ts  # Methods: produce, subscribe, createTopics, deleteTopics, listTopics; producer + consumer + admin; graceful shutdown via beforeApplicationShutdown
│   │   └── kafka.md          # KafkaService documentation: methods, configuration, Kafka-specific nuances, lifecycle
│   └── mongo/
│       ├── mongo.module.ts   # Provides the Mongoose Connection via the MONGO_CONNECTION token; exports MongoService
│       ├── mongo.service.ts  # Methods: getModel (idempotent model registration), startSession (transactions), ping; graceful shutdown via beforeApplicationShutdown and onModuleDestroy
│       └── mongo.md          # MongoService documentation: methods, configuration, transactions, caveats, lifecycle
│
├── logger/                   # Centralised logger (global module)
│   ├── logger.module.ts      # @Global() — registered once in AppModule, accessible everywhere without needing to be imported
│   └── logger.service.ts     # AppLoggerService: implements LoggerService, with colour-coded output based on log level (green/red/yellow/white)
│
└── modules/                  # Business modules (feature-based)
    └── health/
        ├── health.module.ts      # Registers HealthController and GracefulShutdownService
        ├── health.controller.ts  # GET /health — returns 200 OK or 503 if a shutdown is in progress
        └── shutdown.service.ts   # GracefulShutdownService: implements OnApplicationShutdown, maintains the isShuttingDown flag
```

---

## Business domain

Order Processing System — demo online store. The project is needed to demonstrate work with various technologies (src/clients)

### Storages and their roles

| Storage    | What it stores                                                          |
|------------|-------------------------------------------------------------------------|
| PostgreSQL | `users`, `balances`, `orders`, `order_items`                            |
| MongoDB    | `products` (id, name, price, attributes)                                |
| Redis      | `cart:{userId}` (hash, TTL 24h), `product:{id}` (cache, TTL 5 min)      |
| Kafka      | topics `order.created`, `order.paid`, `order.failed`                    |
| RabbitMQ   | exchange `notifications`, queue `notifications.email`                   |
| ClickHouse | table `order_events`                                                    |

### Modules (`src/modules/`). In feature. 

- `auth` — registration and login (JWT)
- `catalog` — product catalogue
- `cart` — shopping cart
- `orders` — order placement
- `payments` — payment result processing
- `notifications` — notification delivery
- `analytics` — analytics
- `emulator` — payment system mock

### Basic flow

```text
[Client]
  │
  ├─ POST /auth/register|login ──────────────► PostgreSQL (users)
  │
  ├─ GET  /catalog/products ─────────────────► MongoDB (products)
  │
  ├─ POST /cart/items ───────────────────────► Redis (cart:{userId} hash)
  │
  └─ POST /orders/checkout
         │
         ├─ Redis      HGETALL cart:{userId}
         ├─ MongoDB    find products (prices)
         ├─ PostgreSQL INSERT orders + order_items (transaction)
         ├─ Redis      DEL cart:{userId}
         ├─ Kafka      PRODUCE order.created
         └─ ClickHouse INSERT order_events

[Emulator] ── consumes order.created
         │
         ├─ 90% ──► Kafka PRODUCE order.paid
         └─ 10% ──► Kafka PRODUCE order.failed

[Payments] ── consumes order.paid / order.failed
         │
         ├─ PostgreSQL UPDATE orders SET status
         ├─ ClickHouse INSERT order_events
         └─ RabbitMQ  PUBLISH notifications.email

[Notifications] ── consumes notifications.email
         └─ log(notification template) → ack()

GET /analytics/summary ────────────────────► ClickHouse (agregations)
```

---

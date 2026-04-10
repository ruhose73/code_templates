# AuthModule

JWT authentication with refresh token rotation and theft detection via `familyId`.

---

## Structure

```
src/modules/auth/
├── auth.module.ts       # Module: dependencies, JwtModule, TypeORM feature registration
├── auth.controller.ts   # REST endpoints
├── auth.service.ts      # Business logic
├── jwt.strategy.ts      # PassportJS JWT strategy + JwtAuthGuard
├── auth.md              # This documentation
└── dto/
    ├── login.dto.ts     # Login or register request body
    ├── refresh.dto.ts   # Token refresh request body
    └── token.dto.ts     # TokenPairDto (Swagger response shape)
```

Related files outside the module:

```
src/constants/auth.constants.ts                            # Configuration constants
src/clients/postgresql/entities/refresh-token.entity.ts   # TypeORM RefreshToken entity
src/clients/postgresql/entities/user.entity.ts             # TypeORM User entity
```

---

## Endpoints

### `POST /auth/register`

Register a new user account.

**Body:** `RegisterDto`

```json
{
  "password": "secreT123!",
  "email": "john@example.com"
}
```

**Response `201`:** `TokenPairDto`

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<hex-string>"
}
```

**Errors:**
- `409 Conflict` — email is already taken

---

### `POST /auth/login`

Authenticate with email and password.

**Body:** `RegisterDto`

```json
{
  "password": "secreT123!",
  "email": "john@example.com"
}
```

**Response `200`:** `TokenPairDto`

**Errors:**
- `401 Unauthorized` — invalid email or password

---

### `POST /auth/refresh`

Rotate the refresh token. The old token is revoked and a new token pair is issued.

**Body:** `RefreshDto`

```json
{
  "refreshToken": "<hex-string>"
}
```

**Response `200`:** `TokenPairDto`

**Errors:**
- `401 Unauthorized` — token not found, already revoked, or expired

> If a previously revoked token is used again (`revoked = true`), the service treats it as
> a theft attempt and revokes the **entire family** (all tokens of that session).
> The user will be forced to log in again.

---

### `POST /auth/logout`

Revoke the current refresh token (logout from the current device).

**Headers:** `Authorization: Bearer <accessToken>`

**Body:** `RefreshDto`

```json
{
  "refreshToken": "<hex-string>"
}
```

**Response `200`:** empty body

---

### `POST /auth/logout-all`

Revoke all refresh tokens for the authenticated user (logout from all devices).

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`:** empty body

---

## Token schema

### Access Token

- Type: stateless JWT (signed with `JWT_SECRET`)
- TTL: `15 minutes`
- Payload:
  ```json
  { "sub": "<userId>", "jti": "<uuid>" }
  ```
- Passed in the header: `Authorization: Bearer <token>`

### Refresh Token

- Type: random hex string of `AUTH_REFRESH_TOKEN_BYTES * 2` characters (default: 128 chars)
- TTL: `AUTH_REFRESH_TOKEN_DAYS` days (default: 30)
- Stored in the database as a SHA-256 hash (`tokenHash`)
- Sent by the client in the request body

---

## Token rotation and theft detection

Each session is identified by `familyId` (UUID, created at login/registration).
Every call to `/auth/refresh` generates a new refresh token with the same `familyId`.

```
Login → familyId = randomUUID()
  │
  └── token_A (familyId: X, revoked: false)

refresh(token_A)
  ├── token_A → revoked: true
  └── token_B (familyId: X, revoked: false)

refresh(token_A) again  ← theft detected
  └── UPDATE refresh_tokens SET revoked = true WHERE family_id = X
      (entire family revoked, including token_B)
```

---

## Database

Table `refresh_tokens` (PostgreSQL):

| Column       | Type         | Description                                |
|--------------|--------------|--------------------------------------------|
| `id`         | uuid PK      | Record identifier                          |
| `userId`     | uuid FK      | Reference to `users.id`, ON DELETE CASCADE |
| `tokenHash`  | varchar(64)  | SHA-256 of the raw token, UNIQUE           |
| `familyId`   | uuid         | Session identifier                         |
| `expiresAt`  | timestamptz  | Expiration timestamp                       |
| `revoked`    | boolean      | Revocation flag                            |
| `createdAt`  | timestamptz  | Creation timestamp (set automatically)     |

Indexes: `idx_refresh_tokens_user_id` (`userId`), `idx_refresh_tokens_family_id` (`familyId`).

---

## JwtStrategy and JwtAuthGuard

`JwtStrategy` (`passport-jwt`) verifies the access token signature and decodes the payload.
The decoded object `{ sub, jti }` is exposed as `req.user` in protected endpoints.

`JwtAuthGuard` and `JwtPayload` are exported from `jwt.strategy.ts`. Both are used
directly inside `AuthController` and can be imported into any other module.

---

## Using JwtAuthGuard in other modules

`AuthModule` does **not** need to export `JwtAuthGuard` or `JwtStrategy` — Passport registers
the `jwt` strategy globally, so the guard works in any module without additional imports.

### 1. Apply the guard to a single route

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt.strategy';

@Controller('catalog')
export class CatalogController {
  @UseGuards(JwtAuthGuard)
  @Get('private')
  getPrivate(@Req() req: { user: JwtPayload }) {
    const userId = req.user.sub; // authenticated user ID
    // ...
  }
}
```

### 2. Protect an entire controller

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  @Get()
  findAll(@Req() req: { user: JwtPayload }) {
    return req.user.sub;
  }
}
```

### 3. Apply globally (app-wide)

Register the guard as a global provider in `AppModule` or `main.ts` to protect
all routes by default:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './modules/auth/jwt.strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(new JwtAuthGuard()); // requires manual Reflector injection for @Public()
  await app.listen(3000);
}
```

> Note: when using `app.useGlobalGuards`, the guard runs outside the DI container.
> If you need `Reflector` (e.g. for a `@Public()` decorator), register the guard
> as a provider instead:
>
> ```typescript
> // app.module.ts
> import { APP_GUARD } from '@nestjs/core';
> import { JwtAuthGuard } from './modules/auth/jwt.strategy';
>
> providers: [
>   { provide: APP_GUARD, useClass: JwtAuthGuard },
> ],
> ```

### JwtPayload fields

| Field | Type   | Description                     |
|-------|--------|---------------------------------|
| `sub` | string | User ID (UUID)                  |
| `jti` | string | Unique token identifier (UUID)  |

---

## Constants (`src/constants/auth.constants.ts`)

All values are read from environment variables with defaults:

| Constant                   | Environment variable       | Default     | Description                        |
|----------------------------|----------------------------|-------------|------------------------------------|
| `AUTH_BCRYPT_ROUNDS`       | `AUTH_BCRYPT_ROUNDS`       | `10`        | bcrypt hashing rounds              |
| `AUTH_REFRESH_TOKEN_BYTES` | `AUTH_REFRESH_TOKEN_BYTES` | `64`        | Bytes used to generate refresh token |
| `AUTH_REFRESH_TOKEN_DAYS`  | `AUTH_REFRESH_TOKEN_DAYS`  | `30`        | Refresh token TTL in days          |
| `AUTH_MS_PER_DAY`          | —                          | `86400000`  | Milliseconds per day (constant)    |

---

## Environment variables

```dotenv
# Required
JWT_SECRET=change_me_in_production

# Optional (have defaults)
AUTH_BCRYPT_ROUNDS=10
AUTH_REFRESH_TOKEN_BYTES=64
AUTH_REFRESH_TOKEN_DAYS=30
```

---

## Registering the module

```typescript
// app.module.ts
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // ...
    AuthModule,
  ],
})
export class AppModule {}
```

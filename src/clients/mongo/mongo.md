# MongoModule

Provides a Mongoose `Connection` instance via the `MONGO_CONNECTION` token and exports `MongoService` for use across feature modules.

## Configuration

| Env variable     | Default                      | Description                |
|------------------|------------------------------|----------------------------|
| `MONGO_URI`      | `mongodb://localhost:27017`  | MongoDB connection string  |
| `MONGO_DATABASE` | `app`                        | Target database name       |

## Registering in AppModule

```typescript
import { MongoModule } from 'src/clients/mongo/mongo.module';

@Module({
  imports: [MongoModule],
})
export class AppModule {}
```

## Injection

```typescript
import { MongoService } from 'src/clients/mongo/mongo.service';

@Injectable()
export class LinkMetaRepository {
  constructor(private readonly mongo: MongoService) {}
}
```

---

## MongoService API

### `getModel<T>(name, schema): Model<T>`

Returns the registered Mongoose model for the given name, or registers it on first call.
Idempotent — safe to call in the constructor or on every request.

```typescript
import { Schema } from 'mongoose';

const LinkMetaSchema = new Schema({
  shortCode: { type: String, required: true, unique: true },
  tags: [String],
  rules: [{ condition: Object, redirectTo: String }],
});

// In your repository/service constructor:
private readonly linkMetaModel = this.mongo.getModel<LinkMetaDocument>('LinkMeta', LinkMetaSchema);
```

Subsequent calls with the same `name` return the cached model and ignore the passed schema.

---

### `startSession(): Promise<ClientSession>`

Starts a Mongoose client session for multi-document transactions.
The caller must commit or abort, then end the session.

```typescript
const session = await this.mongo.startSession();
session.startTransaction();

try {
  await this.linkMetaModel.create([doc], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  await session.endSession();
}
```

---

### `ping(): boolean`

Returns `true` when the Mongoose connection `readyState` is `connected` (1).
Suitable for health checks.

```typescript
const isAlive = this.mongo.ping(); // true | false
```

---

## Lifecycle

The connection is opened once during `useFactory` (awaits `connection.asPromise()` before the provider resolves).

On shutdown:
- `beforeApplicationShutdown` — called on `SIGTERM` / `SIGINT`, closes the connection pool gracefully.
- `onModuleDestroy` — fallback for test teardown or programmatic app shutdown without a signal.

Both hooks call `connection.close()`, which is idempotent if the connection is already closed.

---

## Caveats

- **Schemas must be consistent** across the application lifetime. If `getModel` is called with two different schemas for the same name, the second schema is silently ignored — the first registration wins.
- **Replica set required for transactions.** `startSession()` with `startTransaction()` only works against a MongoDB replica set or sharded cluster; standalone instances do not support multi-document transactions.
- **Collection naming.** Mongoose pluralises and lowercases the model name by default (`LinkMeta` → `linkmetas`). Override with `{ collection: 'link_meta' }` in the schema options if needed.

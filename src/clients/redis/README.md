# RedisService

NestJS-сервис над [ioredis](https://github.com/redis/ioredis). Предоставляет типизированные методы для работы со всеми основными типами данных Redis.

## Подключение

`RedisModule` не является глобальным — импортируй его явно в каждый модуль, которому нужен `RedisService`:

```typescript
@Module({
  imports: [RedisModule],
  providers: [YourRepository],
})
export class YourModule {}
```

Внедри `RedisService` через конструктор:

```typescript
constructor(private readonly redis: RedisService) {}
```

## Конфигурация

Переменные окружения (`.env`):

| Переменная       | Описание              | Дефолт      |
|------------------|-----------------------|-------------|
| `REDIS_HOST`     | Хост Redis            | `localhost` |
| `REDIS_PORT`     | Порт                  | `6379`      |
| `REDIS_PASSWORD` | Пароль (опционально)  | —           |
| `REDIS_DB`       | Номер базы данных     | `0`         |

## Жизненный цикл и graceful shutdown

При получении `SIGTERM`/`SIGINT` NestJS вызывает `beforeApplicationShutdown` — сервис дожидается выполнения всех поставленных в очередь команд ioredis и закрывает соединение. `onModuleDestroy` срабатывает как fallback при teardown без сигнала (например, в тестах).

Требует вызова `app.enableShutdownHooks()` в `main.ts` — иначе NestJS не будет слушать системные сигналы.

---

## Strings

Простые пары ключ–значение. Подходят для кэша, счётчиков, сессий.

### `set(key, value, ttl?): Promise<'OK'>`

Записывает строковое значение. При передаче `ttl` (секунды) устанавливает срок хранения через `EX`.

```typescript
await this.redis.set('user:42:name', 'Alice');
await this.redis.set('session:abc', token, 3600); // истекает через 1 час
```

### `get(key): Promise<string | null>`

Возвращает значение по ключу или `null`, если ключ не существует.

```typescript
const name = await this.redis.get('user:42:name'); // 'Alice' | null
```

### `mget(keys): Promise<Array<string | null>>`

Возвращает значения сразу для нескольких ключей. Порядок результатов соответствует порядку ключей.

```typescript
const [a, b] = await this.redis.mget(['key:1', 'key:2']);
```

### `del(...keys): Promise<number>`

Удаляет один или несколько ключей любого типа. Возвращает количество удалённых ключей.

```typescript
await this.redis.del('key:1', 'key:2');
```

---

## Hashes

Объекты с именованными полями. Подходят для хранения сущностей без сериализации всего объекта.

### `hset(key, field, value): Promise<number>`

Устанавливает значение одного поля. Возвращает `1` если поле создано, `0` если обновлено.

```typescript
await this.redis.hset('user:42', 'email', 'alice@example.com');
```

### `hget(key, field): Promise<string | null>`

Возвращает значение одного поля или `null`.

```typescript
const email = await this.redis.hget('user:42', 'email');
```

### `hmget(key, fields): Promise<Array<string | null>>`

Возвращает значения нескольких полей одного хеша. `null` для отсутствующих полей.

```typescript
const [name, email] = await this.redis.hmget('user:42', ['name', 'email']);
```

### `hgetall(key): Promise<Record<string, string>>`

Возвращает все поля и значения хеша в виде объекта. Пустой объект, если ключ не существует.

```typescript
const user = await this.redis.hgetall('user:42');
// { name: 'Alice', email: 'alice@example.com' }
```

### `hdel(key, ...fields): Promise<number>`

Удаляет одно или несколько полей хеша. Возвращает количество удалённых полей.

```typescript
await this.redis.hdel('user:42', 'tempField');
```

---

## Lists

Упорядоченные двусвязные списки. Подходят для очередей задач, лент событий.

### `lpush(key, ...values): Promise<number>`

Добавляет элементы в начало списка. При передаче нескольких значений они вставляются последовательно — последний аргумент окажется первым в списке.

```typescript
await this.redis.lpush('queue:jobs', 'job:3', 'job:4');
// список: ['job:4', 'job:3', ...предыдущие]
```

### `rpush(key, ...values): Promise<number>`

Добавляет элементы в конец списка в порядке передачи.

```typescript
await this.redis.rpush('queue:jobs', 'job:5', 'job:6');
// список: [...предыдущие, 'job:5', 'job:6']
```

### `lpop(key): Promise<string | null>`

Извлекает и возвращает первый элемент. `null` если список пуст.

```typescript
const job = await this.redis.lpop('queue:jobs');
```

### `rpop(key): Promise<string | null>`

Извлекает и возвращает последний элемент. `null` если список пуст.

```typescript
const last = await this.redis.rpop('queue:jobs');
```

### `lrange(key, start, stop): Promise<string[]>`

Возвращает срез списка по индексам включительно. Отрицательные индексы считаются с конца: `-1` — последний элемент.

```typescript
const all = await this.redis.lrange('queue:jobs', 0, -1);
const first10 = await this.redis.lrange('queue:jobs', 0, 9);
```

### `llen(key): Promise<number>`

Возвращает длину списка. `0` если ключ не существует.

```typescript
const size = await this.redis.llen('queue:jobs');
```

---

## Sets

Неупорядоченные коллекции уникальных строк. Подходят для тегов, ACL, отслеживания уникальных посещений.

### `sadd(key, ...members): Promise<number>`

Добавляет элементы в множество. Дубликаты игнорируются. Возвращает количество фактически добавленных элементов.

```typescript
await this.redis.sadd('tags:post:1', 'redis', 'database', 'cache');
```

### `srem(key, ...members): Promise<number>`

Удаляет элементы из множества. Возвращает количество удалённых.

```typescript
await this.redis.srem('tags:post:1', 'cache');
```

### `smembers(key): Promise<string[]>`

Возвращает все элементы множества. Порядок не гарантирован.

```typescript
const tags = await this.redis.smembers('tags:post:1');
```

### `sismember(key, member): Promise<number>`

Проверяет наличие элемента в множестве. Возвращает `1` (есть) или `0` (нет).

```typescript
const isMember = await this.redis.sismember('tags:post:1', 'redis'); // 1
```

---

## Sorted Sets

Множества с числовым score для каждого элемента. Подходят для рейтингов, очередей с приоритетом, leaderboard.

### `zadd(key, score, member): Promise<number | null>`

Добавляет элемент с указанным score. Если элемент уже существует — обновляет score. Возвращает `1` при добавлении, `0` при обновлении.

```typescript
await this.redis.zadd('leaderboard', 1500, 'user:42');
```

### `zrem(key, ...members): Promise<number>`

Удаляет элементы из sorted set. Возвращает количество удалённых.

```typescript
await this.redis.zrem('leaderboard', 'user:42');
```

### `zrange(key, start, stop, withScores?): Promise<string[]>`

Возвращает элементы по диапазону ранга (от наименьшего score). При `withScores: true` возвращает чередующийся массив `[member, score, member, score, ...]`.

```typescript
const top10 = await this.redis.zrange('leaderboard', 0, 9);
const top10WithScores = await this.redis.zrange('leaderboard', 0, 9, true);
// ['user:1', '2000', 'user:2', '1800', ...]
```

### `zscore(key, member): Promise<string | null>`

Возвращает score элемента в виде строки или `null` если элемент не существует.

```typescript
const score = await this.redis.zscore('leaderboard', 'user:42'); // '1500'
```

---

## Streams

Append-only log-структура. Подходит для event sourcing, очередей сообщений, аудит-лога.

### `xadd(key, id, fields): Promise<string | null>`

Добавляет запись в стрим. Передай `'*'` как `id` для авто-генерации. Возвращает ID созданной записи.

```typescript
const entryId = await this.redis.xadd('events:orders', '*', {
  orderId: '123',
  status: 'created',
});
```

### `xread(keys, ids, count?): Promise<Array<[string, Array<[string, string[]]>]> | null>`

Читает записи из одного или нескольких стримов начиная с указанного ID.

- `'0'` — все записи с начала
- `'$'` — только новые (появившиеся после подписки)
- конкретный ID — записи после него

```typescript
// Читать все записи из стрима
const result = await this.redis.xread(['events:orders'], ['0']);

// Читать не более 10 новых записей
const result = await this.redis.xread(['events:orders'], ['$'], 10);
```

Формат ответа: `[[streamKey, [[entryId, [field, value, ...]], ...]]]`

### `xlen(key): Promise<number>`

Возвращает количество записей в стриме.

```typescript
const count = await this.redis.xlen('events:orders');
```

### `xdel(key, ...ids): Promise<number>`

Удаляет конкретные записи из стрима по ID. Возвращает количество удалённых.

```typescript
await this.redis.xdel('events:orders', '1700000000000-0');
```

---

## Bitmaps

Побитовое хранилище поверх строкового типа. Подходит для компактного хранения булевых флагов (например, посещаемость пользователей по дням).

### `setbit(key, offset, value): Promise<number>`

Устанавливает бит на позиции `offset` в значение `0` или `1`. Возвращает предыдущее значение бита.

```typescript
// Пользователь 42 был активен в день 100
await this.redis.setbit('activity:user:42', 100, 1);
```

### `getbit(key, offset): Promise<number>`

Возвращает значение бита на позиции `offset` (`0` или `1`).

```typescript
const wasActive = await this.redis.getbit('activity:user:42', 100); // 1
```

### `bitcount(key, start?, end?): Promise<number>`

Считает количество установленных битов (`1`). Опциональные `start`/`end` задают диапазон в **байтах** (не битах), индексация включительная.

```typescript
// Всего активных дней
const totalDays = await this.redis.bitcount('activity:user:42');

// Активные дни в первых двух байтах (биты 0–15)
const recentDays = await this.redis.bitcount('activity:user:42', 0, 1);
```

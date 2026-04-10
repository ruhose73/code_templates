# ClickhouseService

NestJS-сервис над [@clickhouse/client](https://github.com/ClickHouse/clickhouse-js). Предоставляет типизированные методы для работы с ClickHouse: SELECT-запросы с параметрами, батчевые вставки, DDL-команды и мутации.

## Подключение

`ClickhouseModule` не является глобальным — импортируй его явно в каждый модуль, которому нужен `ClickhouseService`:

```typescript
@Module({
  imports: [ClickhouseModule],
  providers: [YourRepository],
})
export class YourModule {}
```

Внедри `ClickhouseService` через конструктор:

```typescript
constructor(private readonly clickhouse: ClickhouseService) {}
```

## Конфигурация

Переменные окружения (`.env`):

| Переменная                   | Описание                        | Дефолт                  |
|------------------------------|---------------------------------|-------------------------|
| `CLICKHOUSE_URL`             | URL HTTP-интерфейса ClickHouse  | `http://localhost:8123` |
| `CLICKHOUSE_DATABASE`        | База данных по умолчанию        | `default`               |
| `CLICKHOUSE_USERNAME`        | Имя пользователя                | `default`               |
| `CLICKHOUSE_PASSWORD`        | Пароль                          | `''`                    |
| `CLICKHOUSE_REQUEST_TIMEOUT` | Таймаут запроса в миллисекундах | `60000`                 |

## Жизненный цикл и graceful shutdown

При получении `SIGTERM`/`SIGINT` NestJS вызывает `beforeApplicationShutdown` — сервис закрывает пул HTTP-соединений клиента. `onModuleDestroy` срабатывает как fallback при teardown без OS-сигнала (например, в тестах или при вызове `app.close()`). Повторный вызов `close()` безопасен.

Требует вызова `app.enableShutdownHooks()` в `main.ts` — иначе NestJS не будет слушать системные сигналы.

---

## Особенности ClickHouse

- **Нет одиночных INSERT.** Каждый INSERT — это отдельный сетевой запрос. Вставка по одной строке разрушает производительность. Всегда буферизуй строки и вставляй батчами через `insert()`.
- **UPDATE и DELETE — это мутации.** ClickHouse не поддерживает классические DML-операции. Изменение и удаление строк выполняется через `ALTER TABLE … UPDATE` / `ALTER TABLE … DELETE`. Мутации применяются **асинхронно** — `exec()` возвращает управление сразу после принятия команды, фактическое изменение данных происходит в фоне.
- **Параметры запроса.** Используй именованные плейсхолдеры `{name:Type}` вместо конкатенации строк — клиент передаёт параметры отдельно от SQL, что исключает SQL-инъекции.

---

## Чтение данных

### `query<T>(sql, params?): Promise<T[]>`

Выполняет SELECT и возвращает все строки результата в виде массива типизированных объектов. Результат десериализуется из формата `JSONEachRow`.

Параметры подставляются через `{name:Type}`-плейсхолдеры — клиент передаёт их серверу отдельно от SQL-текста.

Поддерживаемые типы в плейсхолдерах: `String`, `Int32`, `Int64`, `UInt32`, `UInt64`, `Float32`, `Float64`, `Boolean`, `Date`, `DateTime`, `UUID` и другие нативные типы ClickHouse.

```typescript
// Простой запрос без параметров
const rows = await this.clickhouse.query<{ id: string; name: string }>(
  'SELECT id, name FROM users',
);

// Запрос с параметрами (безопасно, без конкатенации строк)
const rows = await this.clickhouse.query<EventRow>(
  'SELECT * FROM events WHERE user_id = {userId:String} AND created_at >= {from:DateTime}',
  { userId: 'u-42', from: '2024-01-01 00:00:00' },
);

// Агрегация
const stats = await this.clickhouse.query<{ date: string; count: string }>(
  `SELECT toDate(created_at) AS date, count() AS count
   FROM events
   WHERE event_type = {type:String}
   GROUP BY date
   ORDER BY date DESC
   LIMIT {limit:UInt32}`,
  { type: 'page_view', limit: 30 },
);
```

### `queryOne<T>(sql, params?): Promise<T | null>`

Возвращает первую строку результата или `null`, если результат пуст. Полезно при выборке одной записи по уникальному ключу.

```typescript
const user = await this.clickhouse.queryOne<UserRow>(
  'SELECT * FROM users WHERE id = {id:String} LIMIT 1',
  { id: 'u-42' },
);

if (user) {
  // user — типизированный объект UserRow
}
```

> Всегда добавляй `LIMIT 1` в SQL при использовании `queryOne` — ClickHouse всё равно вернёт все строки по сети, лимит должен быть выставлен на уровне запроса.

---

## Запись данных

### `insert<T>(table, values): Promise<void>`

Вставляет массив строк в таблицу батчем за один HTTP-запрос. Поля объектов должны соответствовать именам столбцов таблицы.

```typescript
// Батчевая вставка событий
await this.clickhouse.insert('events', [
  { user_id: 'u-1', event_type: 'click', created_at: new Date() },
  { user_id: 'u-2', event_type: 'view',  created_at: new Date() },
  { user_id: 'u-3', event_type: 'click', created_at: new Date() },
]);

// С полным именем таблицы (database.table)
await this.clickhouse.insert('analytics.page_views', rows);
```

> Не вызывай `insert` в цикле по одной строке. Собирай строки в буфер (например, через `setInterval` или при достижении порогового размера) и сбрасывай батчем.

---

## Мутации и DDL

### `exec(sql): Promise<void>`

Отправляет произвольный SQL без возврата строк данных. Используется для:

- DDL: `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE … ADD COLUMN`, `TRUNCATE`
- Мутаций: `ALTER TABLE … UPDATE … WHERE`, `ALTER TABLE … DELETE WHERE`

**Мутации асинхронны** — `exec` возвращает управление сразу после того, как ClickHouse принял команду. Фактическое изменение строк происходит в фоне. Статус выполнения можно отслеживать через системную таблицу `system.mutations`.

```typescript
// Создание таблицы
await this.clickhouse.exec(`
  CREATE TABLE IF NOT EXISTS events (
    user_id    String,
    event_type String,
    created_at DateTime DEFAULT now()
  ) ENGINE = MergeTree()
  ORDER BY (user_id, created_at)
`);

// Truncate
await this.clickhouse.exec('TRUNCATE TABLE events');

// Мутация: обновление поля (асинхронно)
await this.clickhouse.exec(
  `ALTER TABLE users UPDATE name = 'Bob' WHERE id = 'u-42'`,
);

// Мутация: удаление строк (асинхронно)
await this.clickhouse.exec(
  `ALTER TABLE events DELETE WHERE created_at < '2023-01-01 00:00:00'`,
);

// Добавление столбца
await this.clickhouse.exec(
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS session_id String DEFAULT ''`,
);
```

> Следи за накоплением незавершённых мутаций в `system.mutations` — большое их количество влияет на производительность чтения и фоновых слияний.

---

## Утилиты

### `ping(): Promise<boolean>`

Проверяет доступность ClickHouse. Возвращает `true` если сервер ответил успешно, `false` в противном случае. Подходит для health check.

```typescript
const isAlive = await this.clickhouse.ping();

if (!isAlive) {
  this.logger.error('ClickHouse is not reachable');
}
```

---

## Полный пример: репозиторий событий

```typescript
interface EventRow {
  user_id: string;
  event_type: string;
  created_at: string;
}

@Injectable()
export class EventRepository implements OnModuleInit {
  private buffer: EventRow[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private static readonly FLUSH_INTERVAL_MS = 5000;
  private static readonly BUFFER_LIMIT = 1000;

  constructor(private readonly clickhouse: ClickhouseService) {}

  /**
   * Создаёт таблицу при первом запуске, если она не существует.
   */
  async onModuleInit(): Promise<void> {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS events (
        user_id    String,
        event_type String,
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (user_id, created_at)
    `);

    this.flushTimer = setInterval(
      () => this.flush(),
      EventRepository.FLUSH_INTERVAL_MS,
    );
  }

  /**
   * Добавляет событие в буфер; сбрасывает батч при достижении лимита.
   */
  push(event: EventRow): void {
    this.buffer.push(event);

    if (this.buffer.length >= EventRepository.BUFFER_LIMIT) {
      void this.flush();
    }
  }

  /**
   * Принудительно сбрасывает накопленный буфер в ClickHouse.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    await this.clickhouse.insert('events', batch);
  }

  /**
   * Возвращает количество событий указанного типа за период.
   */
  async countByType(eventType: string, from: string, to: string): Promise<number> {
    const row = await this.clickhouse.queryOne<{ cnt: string }>(
      `SELECT count() AS cnt
       FROM events
       WHERE event_type = {type:String}
         AND created_at BETWEEN {from:DateTime} AND {to:DateTime}`,
      { type: eventType, from, to },
    );

    return row ? parseInt(row.cnt, 10) : 0;
  }

  /**
   * Удаляет все события пользователя (мутация — выполняется асинхронно).
   */
  async deleteByUser(userId: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE events DELETE WHERE user_id = '${userId}'`,
    );
  }
}
```

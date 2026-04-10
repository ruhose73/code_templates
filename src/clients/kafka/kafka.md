# KafkaService

NestJS-сервис над [kafkajs](https://kafka.js.org/). Предоставляет типизированные методы для работы с Apache Kafka: отправка сообщений, подписка на топики, управление топиками через admin-клиент.

## Подключение

`KafkaModule` не является глобальным — импортируй его явно в каждый модуль, которому нужен `KafkaService`:

```typescript
@Module({
  imports: [KafkaModule],
  providers: [YourRepository],
})
export class YourModule {}
```

Внедри `KafkaService` через конструктор:

```typescript
constructor(private readonly kafka: KafkaService) {}
```

## Конфигурация

Переменные окружения (`.env`):

| Переменная                  | Описание                                            | Дефолт            |
|-----------------------------|-----------------------------------------------------|-------------------|
| `KAFKA_BROKERS`             | Список брокеров через запятую                       | `localhost:9092`  |
| `KAFKA_CLIENT_ID`           | Идентификатор клиента (отображается в метриках)     | `app`             |
| `KAFKA_GROUP_ID`            | Consumer group ID                                   | `app-group`       |
| `KAFKA_CONNECTION_TIMEOUT`  | Таймаут подключения к брокеру в мс                  | `3000`            |
| `KAFKA_REQUEST_TIMEOUT`     | Таймаут ожидания ответа от брокера в мс             | `60000`           |

Пример `.env`:

```dotenv
KAFKA_BROKERS=broker1:9092,broker2:9092,broker3:9092
KAFKA_CLIENT_ID=orders-service
KAFKA_GROUP_ID=orders-service-group
KAFKA_CONNECTION_TIMEOUT=3000
KAFKA_REQUEST_TIMEOUT=60000
```

## Жизненный цикл и graceful shutdown

При старте модуля (`onModuleInit`) сервис одновременно подключает три клиента через `Promise.all`: producer, consumer и admin.

При получении `SIGTERM`/`SIGINT` NestJS вызывает `beforeApplicationShutdown` — сервис выставляет флаг `isShuttingDown` и отключает всех трёх клиентов. KafkaJS при закрытии consumer'а дожидается завершения текущей обработки сообщения (`eachMessage`) — partitions не перебалансируются до полного выхода.

`onModuleDestroy` срабатывает как fallback при teardown без OS-сигнала (например, в тестах или при вызове `app.close()`). Проверяет флаг `isShuttingDown` и вызывает `disconnect()` только если `beforeApplicationShutdown` ещё не выполнился.

Требует вызова `app.enableShutdownHooks()` в `main.ts` — иначе NestJS не будет слушать системные сигналы.

---

## Публикация сообщений

### `produce(topic, messages): Promise<void>`

Отправляет массив сообщений в указанный топик через producer.

Тип `Message` из `kafkajs`:

| Поле        | Тип                          | Описание                                             |
|-------------|------------------------------|------------------------------------------------------|
| `value`     | `string \| Buffer \| null`   | Тело сообщения (обязательно)                         |
| `key`       | `string \| Buffer \| null`   | Ключ для партиционирования (опционально)             |
| `partition` | `number`                     | Явное указание партиции (опционально)                |
| `headers`   | `IHeaders`                   | Метаданные сообщения в виде key-value (опционально)  |
| `timestamp` | `string`                     | Unix-время в миллисекундах, строкой (опционально)    |

```typescript
// Простая отправка
await this.kafka.produce('orders', [
  { value: JSON.stringify({ orderId: '123', userId: '42' }) },
]);

// С ключом для детерминированного партиционирования
await this.kafka.produce('orders', [
  { key: 'user-42', value: JSON.stringify({ orderId: '123' }) },
]);

// Несколько сообщений за один вызов (батч)
await this.kafka.produce('events', [
  { key: 'evt-1', value: JSON.stringify({ type: 'order.created', orderId: '1' }) },
  { key: 'evt-2', value: JSON.stringify({ type: 'order.created', orderId: '2' }) },
]);

// С заголовками
await this.kafka.produce('orders', [
  {
    value: JSON.stringify(payload),
    headers: { 'x-source': 'api', 'x-correlation-id': requestId },
  },
]);
```

> **Партиционирование по ключу.** Если `key` указан, KafkaJS применяет murmur2-хеширование и отправляет все сообщения с одинаковым ключом в одну и ту же партицию. Это гарантирует порядок обработки событий для одной сущности (например, всех событий одного `userId`).

---

## Получение сообщений

### `subscribe(topics, handler, fromBeginning?): Promise<void>`

Подписывает consumer на один или несколько топиков и запускает цикл обработки. Каждое входящее сообщение передаётся в `handler`.

```typescript
// Подписка на один топик
await this.kafka.subscribe('orders', async (payload) => {
  const { topic, partition, message } = payload;
  const value = message.value?.toString();
  await this.processOrder(JSON.parse(value!));
});

// Подписка на несколько топиков
await this.kafka.subscribe(['orders', 'payments'], async ({ topic, message }) => {
  const value = JSON.parse(message.value!.toString());

  if (topic === 'orders') {
    await this.handleOrder(value);
  } else {
    await this.handlePayment(value);
  }
});

// Чтение с начала (replay)
await this.kafka.subscribe('audit-log', async ({ message }) => {
  await this.auditService.replay(JSON.parse(message.value!.toString()));
}, true);
```

Тип `EachMessagePayload` из `kafkajs`:

| Поле        | Тип       | Описание                           |
|-------------|-----------|------------------------------------|
| `topic`     | `string`  | Имя топика                         |
| `partition` | `number`  | Номер партиции                     |
| `message`   | `KafkaMessage` | Сообщение с полями `key`, `value`, `headers`, `offset`, `timestamp` |
| `heartbeat` | `() => Promise<void>` | Вызови вручную при долгой обработке чтобы не потерять group membership |
| `pause`     | `() => () => void` | Приостанавливает consumption партиции |

> **Важно.** `subscribe` + `consumer.run()` вызываются один раз за жизнь consumer'а. Повторный вызов `subscribe` на том же экземпляре `KafkaService` невозможен — KafkaJS не допускает переконфигурацию после запуска. Если нужна подписка на разные топики — используй разные `groupId` и регистрируй несколько `KafkaModule` с разными провайдерами конфига, либо передавай массив топиков в один `subscribe`.

> **Долгая обработка.** Если `eachMessage`-обработчик выполняется дольше `session.timeout.ms` (по умолчанию 30 сек на брокере), брокер исключит consumer из группы и запустит ребалансировку. Для тяжёлых задач вызывай `payload.heartbeat()` периодически или увеличивай таймаут на стороне брокера.

---

## Управление топиками (Admin)

### `createTopics(topics): Promise<boolean>`

Создаёт топики через admin-клиент. Возвращает `true` если топики были созданы, `false` если они уже существовали.

Тип `ITopicConfig` из `kafkajs`:

| Поле                    | Тип       | Описание                                  |
|-------------------------|-----------|-------------------------------------------|
| `topic`                 | `string`  | Имя топика (обязательно)                  |
| `numPartitions`         | `number`  | Количество партиций (дефолт брокера: `1`) |
| `replicationFactor`     | `number`  | Фактор репликации                         |
| `configEntries`         | `Array<{ name: string; value: string }>` | Конфигурация топика |

```typescript
// Простое создание
await this.kafka.createTopics([
  { topic: 'orders', numPartitions: 3, replicationFactor: 2 },
]);

// С retention и компакцией
await this.kafka.createTopics([
  {
    topic: 'user-events',
    numPartitions: 6,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 дней
      { name: 'cleanup.policy', value: 'compact' },
    ],
  },
]);

// Несколько топиков за раз
const created = await this.kafka.createTopics([
  { topic: 'orders', numPartitions: 3, replicationFactor: 2 },
  { topic: 'payments', numPartitions: 3, replicationFactor: 2 },
  { topic: 'notifications', numPartitions: 1, replicationFactor: 1 },
]);
```

### `deleteTopics(topics): Promise<void>`

Удаляет топики по именам. Операция необратима — все данные удаляются.

```typescript
await this.kafka.deleteTopics(['orders.dead', 'temp-topic']);
```

> Требует `delete.topic.enable=true` на брокере (по умолчанию включено в большинстве конфигураций).

### `listTopics(): Promise<string[]>`

Возвращает список имён всех топиков в кластере, включая системные (с префиксом `__`).

```typescript
const topics = await this.kafka.listTopics();
// ['orders', 'payments', '__consumer_offsets', ...]

const appTopics = topics.filter((t) => !t.startsWith('__'));
```

---

## Полный пример: producer и consumer в одном модуле

```typescript
@Injectable()
export class OrderRepository implements OnModuleInit {
  constructor(
    private readonly kafka: KafkaService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Убедиться, что топик существует
    await this.kafka.createTopics([
      { topic: 'orders', numPartitions: 3, replicationFactor: 1 },
    ]);

    // Запустить consumer
    await this.kafka.subscribe('orders', async ({ message }) => {
      const payload = JSON.parse(message.value!.toString()) as CreateOrderPayload;

      try {
        await this.create(payload);
      } catch (err) {
        this.logger.error('Failed to process order', (err as Error).stack, OrderRepository.name);
      }
    });
  }

  async publishOrderCreated(payload: CreateOrderPayload): Promise<void> {
    await this.kafka.produce('orders', [
      {
        key: payload.userId,
        value: JSON.stringify(payload),
        headers: { 'x-event-type': 'order.created' },
      },
    ]);
  }
}
```

---

## Нюансы Kafka и KafkaJS

**Consumer group и ребалансировка.** Все экземпляры сервиса с одинаковым `KAFKA_GROUP_ID` образуют consumer group — Kafka распределяет партиции между ними. При старте нового экземпляра или падении существующего происходит ребалансировка: на время ребалансировки consumption приостанавливается. Используй уникальный `KAFKA_GROUP_ID` для каждого логически независимого потребителя.

**At-least-once доставка.** KafkaJS по умолчанию коммитит offset автоматически (`autoCommit: true`). Это означает, что при падении приложения во время обработки сообщение может быть доставлено повторно. Делай обработчики идемпотентными или отключай `autoCommit` и управляй офсетами вручную через `consumer.commitOffsets()`.

**Порядок сообщений.** Порядок гарантируется только внутри одной партиции. Для глобального порядка используй один топик с одной партицией — но это ограничивает пропускную способность. Оптимальный подход: использовать ключ сообщения (`key`) для роутинга связанных событий в одну партицию.

**`clientId` и мониторинг.** Значение `KAFKA_CLIENT_ID` отображается в метриках брокера и JMX. Используй осмысленное имя (например, `orders-service`), чтобы отличать клиентов в Kafka Manager / Confluent Control Center.

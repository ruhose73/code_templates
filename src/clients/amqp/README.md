# AmqpService

NestJS-сервис над [amqplib](https://github.com/amqp-node/amqplib). Предоставляет типизированные методы для работы с RabbitMQ: объявление топологии, публикация сообщений, push- и pull-консьюмеры, ack/nack.

## Подключение

`AmqpModule` не является глобальным — импортируй его явно в каждый модуль, которому нужен `AmqpService`:

```typescript
@Module({
  imports: [AmqpModule],
  providers: [YourRepository],
})
export class YourModule {}
```

Внедри `AmqpService` через конструктор:

```typescript
constructor(private readonly amqp: AmqpService) {}
```

## Конфигурация

Переменные окружения (`.env`):

| Переменная                    | Описание                                   | Дефолт      |
|-------------------------------|--------------------------------------------|-------------|
| `AMQP_PROTOCOL`               | Протокол (`amqp` или `amqps`)              | `amqp`      |
| `AMQP_HOST`                   | Хост RabbitMQ                              | `localhost` |
| `AMQP_PORT`                   | Порт                                       | —           |
| `AMQP_USERNAME`               | Имя пользователя                           | `guest`     |
| `AMQP_PASSWORD`               | Пароль                                     | `guest`     |
| `AMQP_VHOST`                  | Virtual host                               | `/`         |
| `AMQP_HEARTBEAT`              | Интервал heartbeat в секундах              | `60`        |
| `AMQP_RECONNECT_DELAY`        | Базовая задержка переподключения в мс      | `1000`      |
| `AMQP_MAX_RECONNECT_ATTEMPTS` | Максимальное количество попыток переподключения | `10`   |

## Жизненный цикл и graceful shutdown

При старте модуля (`onModuleInit`) сервис устанавливает TCP-соединение с брокером и создаёт канал.

При получении `SIGTERM`/`SIGINT` NestJS вызывает `beforeApplicationShutdown` — сервис выставляет флаг `isShuttingDown` (чтобы подавить retry-логику), затем закрывает канал и соединение. Закрытие канала выполняется первым: amqplib отправляет протокольный фрейм `CHANNEL.CLOSE` и ждёт `CHANNEL.CLOSE-OK` от брокера, гарантируя что все буферизованные сообщения приняты до разрыва TCP-соединения.

`onModuleDestroy` срабатывает как fallback при teardown без OS-сигнала (например, в тестах или при вызове `app.close()`). Проверяет, не закрыто ли соединение уже `beforeApplicationShutdown`, и вызывает тот же `disconnect()` только если нужно. После каждого закрытия ссылки `channel` и `connection` обнуляются, что делает повторный вызов безопасным.

Требует вызова `app.enableShutdownHooks()` в `main.ts` — иначе NestJS не будет слушать системные сигналы.

## Retry-логика (переподключение)

При неожиданном закрытии соединения (`close`-событие) сервис автоматически пытается переподключиться с линейным backoff:

```
задержка = номер_попытки × AMQP_RECONNECT_DELAY
```

Пример при `AMQP_RECONNECT_DELAY=1000` и `AMQP_MAX_RECONNECT_ATTEMPTS=10`:

| Попытка | Задержка перед попыткой |
|---------|-------------------------|
| 1       | 1 000 мс                |
| 2       | 2 000 мс                |
| 3       | 3 000 мс                |
| ...     | ...                     |
| 10      | 10 000 мс               |

После исчерпания всех попыток сервис логирует ошибку и прекращает переподключение. Событие `error` на соединении логируется, но не прерывает работу — брокер сам закроет соединение, что запустит retry.

---

## Топология: exchange и queue

Перед публикацией и получением сообщений нужно объявить топологию. Обычно это делается один раз при старте модуля — в `onModuleInit` репозитория или сервиса, который использует `AmqpService`.

### `assertExchange(exchange, type, options?): Promise<void>`

Объявляет exchange на брокере. Если exchange уже существует с теми же параметрами — ничего не делает. Если параметры расходятся — брокер вернёт ошибку.

Типы exchange:

| Тип       | Маршрутизация                                                           |
|-----------|-------------------------------------------------------------------------|
| `direct`  | По точному совпадению routing key                                       |
| `topic`   | По паттерну с wildcards: `*` (одно слово), `#` (ноль или более слов)   |
| `fanout`  | Широковещательно — всем привязанным очередям, routing key игнорируется  |
| `headers` | По заголовкам сообщения, routing key игнорируется                       |

```typescript
// Direct exchange
await this.amqp.assertExchange('orders', 'direct', { durable: true });

// Topic exchange
await this.amqp.assertExchange('events', 'topic', { durable: true });

// Fanout exchange
await this.amqp.assertExchange('notifications', 'fanout', { durable: true });
```

### `assertQueue(queue, options?): Promise<Replies.AssertQueue>`

Объявляет очередь. Возвращает объект с именем очереди (`queue`), количеством сообщений (`messageCount`) и количеством консьюмеров (`consumerCount`).

```typescript
// Постоянная очередь (переживает рестарт брокера)
const q = await this.amqp.assertQueue('orders.created', { durable: true });

// Временная очередь с авто-удалением (имя генерирует брокер)
const q = await this.amqp.assertQueue('', { exclusive: true });
// q.queue === 'amq.gen-xxxxx'

// Очередь с TTL и dead-letter exchange
const q = await this.amqp.assertQueue('orders.retry', {
  durable: true,
  arguments: {
    'x-message-ttl': 5000,
    'x-dead-letter-exchange': 'orders.dlx',
  },
});
```

### `bindQueue(queue, exchange, routingKey): Promise<void>`

Привязывает очередь к exchange. Одна очередь может быть привязана к нескольким exchange с разными routing key.

```typescript
// Direct/Topic: routing key как фильтр
await this.amqp.bindQueue('orders.created', 'orders', 'order.created');
await this.amqp.bindQueue('orders.all', 'events', 'order.#');

// Fanout: routing key игнорируется (передай пустую строку)
await this.amqp.bindQueue('notifications.email', 'notifications', '');
```

---

## Публикация сообщений

### `publish(exchange, routingKey, message, options?): void`

Публикует сообщение в exchange. Сообщение автоматически сериализуется в JSON и упаковывается в `Buffer`.

Метод синхронный — amqplib буферизует сообщения внутри и гарантирует доставку брокеру при наличии соединения. Если нужна гарантия подтверждения от брокера — используй `ConfirmChannel` (в текущей реализации не поддерживается).

```typescript
// Базовая публикация
this.amqp.publish('orders', 'order.created', { orderId: '123', userId: '42' });

// Персистентное сообщение (переживает рестарт брокера)
this.amqp.publish('orders', 'order.created', payload, { persistent: true });

// С кастомными заголовками
this.amqp.publish('orders', 'order.created', payload, {
  persistent: true,
  headers: { 'x-source': 'api', 'x-version': '2' },
});

// В fanout exchange — routing key игнорируется
this.amqp.publish('notifications', '', { type: 'user.registered', userId: '42' });
```

---

## Получение сообщений

### `consume(queue, handler, options?): Promise<string>`

Регистрирует push-консьюмера на очереди. Брокер доставляет сообщения в `handler` по мере их поступления. Возвращает `consumerTag` — идентификатор подписки, который можно использовать для отмены консьюмера через `channel.cancel()`.

`null`-доставки (server-side cancel) автоматически игнорируются.

```typescript
const tag = await this.amqp.consume('orders.created', async (msg) => {
  const payload = JSON.parse(msg.content.toString());

  try {
    await this.orderService.create(payload);
    this.amqp.ack(msg);
  } catch (err) {
    // requeue: false — сообщение уходит в dead-letter (если настроен)
    this.amqp.nack(msg, false);
  }
});
```

Опции `consume`:

| Опция       | Описание                                                             |
|-------------|----------------------------------------------------------------------|
| `noAck`     | Брокер не ждёт подтверждения — сообщения удаляются сразу при доставке |
| `exclusive` | Только один консьюмер может читать из очереди одновременно          |
| `priority`  | Приоритет консьюмера (если включён на очереди)                      |

```typescript
// Режим без подтверждений (for fire-and-forget / read-only)
await this.amqp.consume('events.log', (msg) => {
  this.logger.log(msg.content.toString());
}, { noAck: true });
```

### `get(queue, options?): Promise<GetMessage | false>`

Pull-модель: извлекает одно сообщение из очереди без регистрации постоянного консьюмера. Возвращает `false` если очередь пуста.

Подходит для периодического опроса или обработки по одному сообщению.

```typescript
const msg = await this.amqp.get('orders.pending');

if (msg) {
  const payload = JSON.parse(msg.content.toString());
  await this.processOrder(payload);
  this.amqp.ack(msg);
}
```

---

## Подтверждения: ack и nack

### `ack(msg): void`

Положительное подтверждение. Сообщает брокеру, что сообщение успешно обработано — брокер удаляет его из очереди.

```typescript
this.amqp.ack(msg);
```

### `nack(msg, requeue?): void`

Отрицательное подтверждение. `requeue` (по умолчанию `false`) определяет судьбу сообщения:

- `requeue: false` — сообщение отклоняется. Если на очереди настроен dead-letter exchange, оно туда попадёт; иначе удаляется.
- `requeue: true` — сообщение возвращается в очередь и будет доставлено снова.

```typescript
// Отклонить без повтора (отправить в DLX)
this.amqp.nack(msg, false);

// Вернуть в очередь для повторной обработки
this.amqp.nack(msg, true);
```

> Будь осторожен с `requeue: true` при постоянных ошибках — сообщение будет зациклено между брокером и консьюмером. Предпочтительнее использовать dead-letter exchange с TTL для контролируемого retry.

---

## Полный пример: объявление топологии и обработка сообщений

```typescript
@Injectable()
export class OrderRepository implements OnModuleInit {
  constructor(private readonly amqp: AmqpService) {}

  async onModuleInit(): Promise<void> {
    // 1. Объявить exchange и очереди
    await this.amqp.assertExchange('orders', 'topic', { durable: true });
    await this.amqp.assertExchange('orders.dlx', 'direct', { durable: true });

    await this.amqp.assertQueue('orders.created', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'orders.dlx',
        'x-dead-letter-routing-key': 'orders.created.dead',
      },
    });
    await this.amqp.assertQueue('orders.dead', { durable: true });

    // 2. Привязать очереди
    await this.amqp.bindQueue('orders.created', 'orders', 'order.created');
    await this.amqp.bindQueue('orders.dead', 'orders.dlx', 'orders.created.dead');

    // 3. Запустить консьюмера
    await this.amqp.consume('orders.created', async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as CreateOrderPayload;

      try {
        await this.create(payload);
        this.amqp.ack(msg);
      } catch {
        this.amqp.nack(msg, false); // уйдёт в orders.dead
      }
    });
  }

  publishOrderCreated(payload: CreateOrderPayload): void {
    this.amqp.publish('orders', 'order.created', payload, { persistent: true });
  }
}
```

# Order Processing System — NestJS Code Templates

## Что это такое

Демо-проект интернет-магазина на NestJS (Fastify) + TypeScript. Основная цель — не бизнес-логика, а **шаблоны интеграций**: здесь собраны готовые клиенты для всех популярных хранилищ и брокеров, которые можно копировать в реальные проекты.

Проект реализует полный цикл обработки заказа: регистрация → каталог → корзина → оформление заказа → оплата → уведомление → аналитика.

## Зачем столько клиентов

Каждое хранилище используется по назначению — так, как оно используется в продакшн-системах:

| Хранилище   | Роль в проекте                                         | Зачем именно оно                              |
|-------------|--------------------------------------------------------|-----------------------------------------------|
| PostgreSQL  | Пользователи, балансы, заказы, позиции заказов         | Транзакции, консистентность, реляции          |
| MongoDB     | Каталог товаров (id, name, price, attributes)          | Гибкая схема, документо-ориентированные данные|
| Redis       | Корзина (`cart:{userId}`), кеш товаров                 | Быстрый доступ, TTL, хеш-структуры            |
| Kafka       | События `order.created`, `order.paid`, `order.failed`  | Надёжная асинхронная очередь событий          |
| RabbitMQ    | Нотификации на email                                   | Routing по exchange/queue, точечная доставка  |
| ClickHouse  | Лента событий заказов для аналитики                    | Аналитические агрегации на больших объёмах    |

Каждый клиент (`src/clients/`) — самостоятельный NestJS-модуль с сервисом, конфигом и документацией (`.md`-файл рядом). Его можно вырезать и вставить в другой проект.

## Стек

- **Runtime:** Node.js 20.x, TypeScript 5.x
- **Framework:** NestJS на Fastify
- **ORM:** TypeORM (PostgreSQL)
- **ODM:** Mongoose (MongoDB)
- **Тестирование:** Jest + Supertest
- **Документация API:** Swagger (OpenAPI)

## Архитектура

```
src/
├── clients/        # Клиенты: PostgreSQL, MongoDB, Redis, Kafka, RabbitMQ, ClickHouse
├── modules/        # Бизнес-модули: auth, catalog, cart, orders, payments, notifications, analytics, emulator
├── config/         # Конфиги подключений (read-only)
├── logger/         # Глобальный логгер
└── main.ts         # Точка входа
```

## Основной flow

```
POST /auth/register|login  →  PostgreSQL (users)
GET  /catalog/products     →  MongoDB (products)
POST /cart/items           →  Redis (cart:{userId})

POST /orders/checkout:
  ├─ Redis      HGETALL cart
  ├─ MongoDB    цены товаров
  ├─ PostgreSQL INSERT orders + order_items (транзакция)
  ├─ Redis      DEL cart
  ├─ Kafka      PRODUCE order.created
  └─ ClickHouse INSERT order_events

[Emulator] consume order.created
  ├─ 90% → Kafka PRODUCE order.paid
  └─ 10% → Kafka PRODUCE order.failed

[Payments] consume order.paid / order.failed
  ├─ PostgreSQL UPDATE orders SET status
  ├─ ClickHouse INSERT order_events
  └─ RabbitMQ   PUBLISH notifications.email

[Notifications] consume notifications.email
  └─ log(шаблон письма) → ack()

GET /analytics/summary  →  ClickHouse (агрегации)
```

## Запуск

```bash
npm install
npm run start:dev
```

Swagger UI доступен по адресу `http://localhost:{PORT}/api`.

## Тесты

```bash
npm run test        # unit
npm run test:e2e    # интеграционные
npm run test:cov    # покрытие
```

## Структура клиентов

Каждый клиент в `src/clients/` содержит:
- `*.module.ts` — NestJS-модуль, экспортирует сервис и/или токен
- `*.service.ts` — инкапсулирует работу с хранилищем
- `*.md` — документация: методы, примеры, нюансы, lifecycle

Это позволяет копировать клиент целиком в любой NestJS-проект без изменений.

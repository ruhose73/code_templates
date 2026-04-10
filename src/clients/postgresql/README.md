# PostgresqlModule

NestJS-модуль, который экспортирует токен `POSTGRESQL_DATA_SOURCE` — TypeORM `DataSource` глобального соединения, зарегистрированного в `AppModule` через `TypeOrmModule.forRoot()`. Используй этот токен в репозиториях вместо прямого обращения к TypeORM.

## Подключение

`PostgresqlModule` не является глобальным — импортируй его явно в каждый модуль, которому нужен `POSTGRESQL_DATA_SOURCE`:

```typescript
@Module({
  imports: [PostgresqlModule],
  providers: [UserRepository],
})
export class UserModule {}
```

Внедри `DataSource` через конструктор с помощью декоратора `@Inject`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { POSTGRESQL_DATA_SOURCE } from 'src/clients/postgresql/postgresql.module';

@Injectable()
export class UserRepository {
  constructor(
    @Inject(POSTGRESQL_DATA_SOURCE)
    private readonly dataSource: DataSource,
  ) {}
}
```

## Конфигурация

Переменные окружения (`.env`):

| Переменная    | Описание              | Дефолт      |
|---------------|-----------------------|-------------|
| `DB_HOST`     | Хост PostgreSQL       | —           |
| `DB_PORT`     | Порт                  | `5432`      |
| `DB_USERNAME` | Имя пользователя      | —           |
| `DB_PASSWORD` | Пароль                | —           |
| `DB_DATABASE` | Имя базы данных       | —           |
| `DB_LOGGING`  | Логировать SQL-запросы| `false`     |

Конфигурация читается из `src/config/database.config.ts` и передаётся в `TypeOrmModule.forRoot()` в `AppModule`.

---

## Работа через репозиторий TypeORM

### Стандартный репозиторий сущности

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { POSTGRESQL_DATA_SOURCE } from 'src/clients/postgresql/postgresql.module';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  private readonly repo: Repository<UserEntity>;

  constructor(
    @Inject(POSTGRESQL_DATA_SOURCE)
    private readonly dataSource: DataSource,
  ) {
    this.repo = dataSource.getRepository(UserEntity);
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    return this.repo.save(user);
  }
}
```

### Сырые SQL-запросы

Для запросов, которые не укладываются в QueryBuilder, используй `this.repo.query()` — **предпочтительный вариант**. В отличие от `dataSource.query()`, он работает в контексте репозитория и использует то же соединение, что и EntityManager, что обеспечивает корректную работу транзакций и дополнительные защиты TypeORM.

```typescript
// Позиционные плейсхолдеры: $1, $2, …
const rows = await this.repo.query<{ id: number; name: string }>(
  'SELECT id, name FROM users WHERE status = $1 AND created_at > $2',
  ['active', new Date('2024-01-01')],
);
```

`dataSource.query()` используй только когда запрос не привязан к конкретной сущности (например, в транзакции через `em.query()`).

> Никогда не подставляй значения в SQL через конкатенацию строк — используй позиционные параметры `$1, $2, …`.

---

## Транзакции

### `dataSource.transaction(fn)`

Оборачивает операции в транзакцию. Коммит происходит при успешном завершении, откат — при любом выброшенном исключении.

```typescript
await this.dataSource.transaction(async (em) => {
  await em.save(UserEntity, { name: 'Alice' });
  await em.save(WalletEntity, { userId: 1, balance: 0 });
});
```

### Ручное управление транзакцией

Когда нужен явный контроль над точками сохранения или несколькими шагами:

```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  await queryRunner.manager.save(UserEntity, { name: 'Bob' });
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

---

## Полный пример: репозиторий с транзакцией

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { POSTGRESQL_DATA_SOURCE } from 'src/clients/postgresql/postgresql.module';
import { UserEntity } from '../entities/user.entity';
import { WalletEntity } from '../entities/wallet.entity';

@Injectable()
export class UserRepository {
  constructor(
    @Inject(POSTGRESQL_DATA_SOURCE)
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Регистрирует пользователя и создаёт ему кошелёк в одной транзакции.
   */
  async registerWithWallet(name: string, email: string): Promise<UserEntity> {
    return this.dataSource.transaction(async (em) => {
      const user = await em.save(UserEntity, { name, email });
      await em.save(WalletEntity, { userId: user.id, balance: 0 });

      return user;
    });
  }

  /**
   * Возвращает активных пользователей с количеством заказов.
   */
  async findActiveWithOrderCount(): Promise<{ id: number; name: string; orderCount: string }[]> {
    return this.dataSource.query(
      `SELECT u.id, u.name, COUNT(o.id) AS "orderCount"
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.status = $1
       GROUP BY u.id, u.name`,
      ['active'],
    );
  }
}
```

# CartModule

Shopping cart backed by Redis hashes with a 24-hour TTL. Product data is snapshotted on `addItem` so subsequent reads require no MongoDB lookup.

---

## Structure

```
src/modules/cart/
├── cart.module.ts       # Module: imports RedisModule and ProductModule
├── cart.controller.ts   # REST endpoints (all routes require JWT)
├── cart.service.ts      # Business logic: stock validation, product snapshot
├── cart.repository.ts   # Redis operations (hash per user, TTL management)
├── cart.md              # This documentation
├── dto/
│   ├── add-cart-item.dto.ts          # POST /cart/items request body
│   ├── remove-cart-item-query.dto.ts # DELETE /cart/items/:productId query params
│   ├── cart-item.dto.ts              # Response shape (includes productId)
│   └── stored-cart-item.dto.ts       # Internal Redis-stored shape (no productId)
└── serializer/
    └── cart-item.serializer.ts       # deserializeStoredCartItem / serializeCartItem
```

Related files outside the module:

```
src/clients/redis/redis.service.ts             # RedisService (hget, hset, hdel, hgetall, expire, del)
src/modules/product/product.repository.ts      # ProductRepository.findProductById (MongoDB)
src/modules/product/dto/product.dto.ts         # GetProductParamDto (productId path param)
```

---

## Endpoints

All endpoints require `Authorization: Bearer <accessToken>`.

### `GET /cart`

Returns all items in the current user's cart.

**Response `200`:** `CartItemDto[]`

```json
[
  {
    "productId": "6650f1e2a1b2c3d4e5f60002",
    "name": "Wireless Headphones",
    "description": "Over-ear noise cancelling wireless headphones",
    "price": 4999,
    "quantity": 2
  }
]
```

---

### `POST /cart/items`

Adds a product to the cart. If the product is already present, increments the quantity.
Product data (name, description, price) is fetched from MongoDB once and snapshotted in Redis.

**Body:** `AddCartItemDto`

```json
{
  "productId": "6650f1e2a1b2c3d4e5f60002",
  "quantity": 2
}
```

**Response `200`:** `CartItemDto[]` — updated cart

**Errors:**
- `404 Not Found` — product does not exist (`PRODUCT_NOT_FOUND`)
- `400 Bad Request` — requested quantity exceeds available stock (`INSUFFICIENT_STOCK`)

---

### `DELETE /cart/items/:productId`

Removes units of a product from the cart.

- Pass `?quantity=N` to decrement by N units. If the result drops to zero, the product is removed.
- Omit `?quantity` to remove the product entirely regardless of current quantity.

**Query:** `RemoveCartItemQueryDto`

| Parameter  | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `quantity` | number | No       | Units to decrement; omit to remove entirely      |

**Response `200`:** `CartItemDto[]` — updated cart

---

### `DELETE /cart`

Clears the entire cart (deletes the Redis key).

**Response `204`:** empty body

---

## Redis schema

Each cart is stored as a Redis hash under the key `cart:{userId}`.

- **Key:** `cart:{userId}`
- **Field:** `{productId}` (MongoDB ObjectId string)
- **Value:** JSON-serialised `StoredCartItemDto`
- **TTL:** `86400` seconds (24 hours), reset on every `addItem` and `removeItem`

Example hash entry:

```
HSET cart:abc-123 6650f1e2a1b2c3d4e5f60002 '{"name":"Wireless Headphones","description":"Over-ear noise cancelling wireless headphones","price":4999,"quantity":2}'
```

### `StoredCartItemDto` (Redis value)

| Field         | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `name`        | string | Product name snapshot                    |
| `description` | string | Product description snapshot             |
| `price`       | number | Price in minor units at time of add      |
| `quantity`    | number | Current number of units in the cart      |

### `CartItemDto` (API response)

`StoredCartItemDto` + `productId` (the hash field key), assembled by `serializeCartItem`.

---

## Data flow

### addItem

```
POST /cart/items
  │
  ├─ MongoDB   ProductRepository.findProductById(productId)   ← validate existence + stock
  ├─ Redis     HGET cart:{userId} {productId}                 ← read current quantity
  ├─ Redis     HSET cart:{userId} {productId} <snapshot+qty>  ┐ parallel
  ├─ Redis     EXPIRE cart:{userId} 86400                     ┘
  └─ Redis     HGETALL cart:{userId}                          ← return updated cart
```

### removeItem

```
DELETE /cart/items/:productId[?quantity=N]
  │
  ├─ (no quantity) Redis HDEL cart:{userId} {productId}
  │
  └─ (with quantity)
       ├─ Redis HGET cart:{userId} {productId}
       ├─ newQty = stored.quantity - N
       ├─ (newQty ≤ 0) → Redis HDEL cart:{userId} {productId}
       └─ (newQty > 0) → Redis HSET + EXPIRE (parallel)
  │
  └─ Redis HGETALL cart:{userId}  ← return updated cart
```

---

## Serializer (`cart-item.serializer.ts`)

| Function                  | Signature                                              | Description                                         |
|---------------------------|--------------------------------------------------------|-----------------------------------------------------|
| `deserializeStoredCartItem` | `(json: string) => StoredCartItemDto`                | Parses a Redis hash field value into a typed object |
| `serializeCartItem`         | `(productId: string, stored: StoredCartItemDto) => CartItemDto` | Combines a hash field key with stored data into the API response shape |

---

## Registering the module

```typescript
// app.module.ts
import { CartModule } from './modules/cart/cart.module';

@Module({
  imports: [
    // ...
    CartModule,
  ],
})
export class AppModule {}
```

# ProductModule

Product catalogue backed by MongoDB. Exposes public (no auth required) endpoints for listing catalogs and products. `ProductRepository` is also exported for use by other modules (e.g. `CartModule`, `OrdersModule`).

---

## Structure

```
src/modules/product/
├── product.module.ts        # Module: imports MongoModule; exports ProductService and ProductRepository
├── product.controller.ts    # REST endpoints (no auth required)
├── product.service.ts       # Business logic: existence validation, pagination
├── product.repository.ts    # MongoDB queries via MongoService
├── product.md               # This documentation
├── dto/
│   ├── catalog.dto.ts       # CatalogDto (response) + GetCatalogParamDto (path param)
│   └── product.dto.ts       # ProductDto (response) + GetProductParamDto (path param)
└── serializer/
    ├── catalog.serializer.ts  # serializeCatalog: ICatalog → CatalogDto
    └── product.serializer.ts  # serializeProduct: IProduct → ProductDto
```

Related files outside the module:

```
src/clients/mongo/models/catalog.model.ts   # ICatalog interface + CatalogSchema (Mongoose)
src/clients/mongo/models/product.model.ts   # IProduct interface + ProductSchema (Mongoose)
src/clients/mongo/mongo.service.ts          # MongoService.getModel (idempotent model registration)
src/common/pagination/pagination.dto.ts     # PaginationQueryDto (limit, offset)
src/common/pagination/pagination.ts         # DEFAULT_LIMIT=50, MIN_LIMIT=25, DEFAULT_OFFSET=0
```

---

## Endpoints

No authentication required.

### `GET /catalog`

Returns all catalogs.

**Response `200`:** `CatalogDto[]`

```json
[
  {
    "id": "6650f1e2a1b2c3d4e5f60001",
    "name": "Electronics",
    "description": "All electronic devices and accessories"
  }
]
```

---

### `GET /catalog/:catalogId/products`

Returns a paginated list of products belonging to the specified catalog, sorted by `createdAt` ascending.

**Path param:** `catalogId` — MongoDB ObjectId of the catalog

**Query params:** `PaginationQueryDto`

| Parameter | Type   | Required | Default | Min | Description                     |
|-----------|--------|----------|---------|-----|---------------------------------|
| `limit`   | number | No       | `50`    | `25`| Maximum number of products      |
| `offset`  | number | No       | `0`     | `0` | Number of products to skip      |

**Response `200`:** `ProductDto[]`

```json
[
  {
    "id": "6650f1e2a1b2c3d4e5f60002",
    "catalogId": "6650f1e2a1b2c3d4e5f60001",
    "name": "Wireless Headphones",
    "description": "Over-ear noise cancelling wireless headphones",
    "price": 4999,
    "quantity": 100,
    "attributes": { "color": "black", "weight": "250g" }
  }
]
```

**Errors:**
- `404 Not Found` — catalog does not exist (`CATALOG_NOT_FOUND`)

---

### `GET /catalog/products/:productId`

Returns a single product by its MongoDB ObjectId.

**Path param:** `productId` — MongoDB ObjectId of the product

**Response `200`:** `ProductDto`

**Errors:**
- `404 Not Found` — product does not exist (`PRODUCT_NOT_FOUND`)

---

## MongoDB schema

### Collection `catalogs` (`ICatalog`)

| Field         | Type     | Description                        |
|---------------|----------|------------------------------------|
| `_id`         | ObjectId | MongoDB document identifier        |
| `name`        | string   | Catalog name (required, trimmed)   |
| `description` | string   | Catalog description (default: `""`) |
| `createdAt`   | Date     | Auto-managed by Mongoose `timestamps` |
| `updatedAt`   | Date     | Auto-managed by Mongoose `timestamps` |

### Collection `products` (`IProduct`)

| Field         | Type     | Description                                          |
|---------------|----------|------------------------------------------------------|
| `_id`         | ObjectId | MongoDB document identifier                          |
| `catalogId`   | ObjectId | Reference to `catalogs._id` (indexed)                |
| `name`        | string   | Product name (required, trimmed)                     |
| `description` | string   | Product description (required, trimmed)              |
| `price`       | number   | Price in minor units, e.g. cents (required, min `0`) |
| `quantity`    | number   | Units available in stock (required, min `0`)         |
| `attributes`  | Mixed    | Arbitrary key-value attributes (default: `{}`)       |
| `createdAt`   | Date     | Auto-managed by Mongoose `timestamps`                |
| `updatedAt`   | Date     | Auto-managed by Mongoose `timestamps`                |

---

## Repository methods

`ProductRepository` exposes methods beyond the REST surface for use by other modules.

| Method                                                  | Description                                                                          |
|---------------------------------------------------------|--------------------------------------------------------------------------------------|
| `getCatalogs(): Promise<CatalogDto[]>`                  | Returns all catalogs                                                                 |
| `findCatalogById(catalogId): Promise<CatalogDto\|null>` | Finds a catalog by ObjectId; returns `null` if not found                             |
| `findByCatalogId(catalogId, limit, offset): Promise<ProductDto[]>` | Paginated product list for a catalog, sorted by `createdAt` ascending     |
| `findProductById(productId): Promise<ProductDto\|null>` | Finds a product by ObjectId; returns `null` if not found                             |
| `findManyByIds(productIds): Promise<ProductDto[]>`      | Fetches multiple products by ObjectId array; missing products are silently omitted   |
| `assertStockAvailable(productId, quantity): Promise<boolean>` | Returns `true` if the product exists and `product.quantity >= quantity`        |

---

## Serializers

| Function           | Signature                               | Description                          |
|--------------------|-----------------------------------------|--------------------------------------|
| `serializeProduct` | `(product: IProduct) => ProductDto`     | Maps a Mongoose lean document to `ProductDto` |
| `serializeCatalog` | `(catalog: ICatalog) => CatalogDto`     | Maps a Mongoose lean document to `CatalogDto` |

Both functions are used internally by `ProductRepository` after `.lean().exec()` queries.

---

## Using ProductRepository in other modules

`ProductModule` exports both `ProductService` and `ProductRepository`. Import `ProductModule` to access them:

```typescript
// cart.module.ts
import { ProductModule } from '../product/product.module';

@Module({
  imports: [RedisModule, ProductModule],
  // ...
})
export class CartModule {}
```

Then inject `ProductRepository` directly in a service:

```typescript
import { ProductRepository } from '../product/product.repository';

@Injectable()
export class CartService {
  constructor(private readonly productRepository: ProductRepository) {}

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.productRepository.findProductById(dto.productId);
    // ...
  }
}
```

---

## Registering the module

```typescript
// app.module.ts
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    // ...
    ProductModule,
  ],
})
export class AppModule {}
```

import { Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import { CATALOG_MODEL, CatalogSchema, ICatalog } from 'src/clients/mongo/models/catalog.model';
import { IProduct, PRODUCT_MODEL, ProductSchema } from '../../clients/mongo/models/product.model';
import { MongoService } from '../../clients/mongo/mongo.service';
import { CatalogDto } from './dto/catalog.dto';
import { ProductDto } from './dto/product.dto';
import { serializeCatalog, serializeProduct } from './serializer/product.serializer';

@Injectable()
export class ProductRepository {
  private readonly productModel: Model<IProduct>;
  private readonly catalogModel: Model<ICatalog>;

  constructor(private readonly mongoService: MongoService) {
    this.productModel = this.mongoService.getModel<IProduct>(PRODUCT_MODEL, ProductSchema);
    this.catalogModel = this.mongoService.getModel<ICatalog>(CATALOG_MODEL, CatalogSchema);
  }

  /**
   * Returns a page of products for a catalog sorted by {@link IProduct.createdAt} ascending.
   * @param catalogId - MongoDB ObjectId string of the catalog.
   * @param limit - Maximum number of products to return.
   * @param offset - Number of products to skip.
   */
  async findByCatalogId(catalogId: string, limit: number, offset: number): Promise<ProductDto[]> {
    try {
      const products = await this.productModel
        .find({ catalogId: new Types.ObjectId(catalogId) })
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec();
      return products.map(serializeProduct);
    } catch (err) {
      throw new Error(`Failed to fetch products for catalog "${catalogId}": ${err}`);
    }
  }

  /**
   * Returns a single product by its MongoDB ObjectId string, or `null` if not found.
   * @param productId - MongoDB ObjectId string of the product.
   */
  async findProductById(productId: string): Promise<ProductDto | null> {
    try {
      const product = await this.productModel.findById(productId).lean().exec();
      return product ? serializeProduct(product) : null;
    } catch (err) {
      throw new Error(`Failed to fetch product "${productId}": ${err}`);
    }
  }

  /**
   * Returns a single catalog by its MongoDB ObjectId string, or `null` if not found.
   * @param catalogId - MongoDB ObjectId string of the catalog.
   */
  async findCatalogById(catalogId: string): Promise<CatalogDto | null> {
    try {
      const catalog = await this.catalogModel.findById(catalogId).lean().exec();
      return catalog ? serializeCatalog(catalog) : null;
    } catch (err) {
      throw new Error(`Failed to fetch catalog "${catalogId}": ${err}`);
    }
  }

  /**
   * Returns products matching the given list of MongoDB ObjectId strings.
   * Products not found in the database are silently omitted from the result.
   * @param productIds - Array of MongoDB ObjectId strings
   */
  async findManyByIds(productIds: string[]): Promise<ProductDto[]> {
    try {
      const objectIds = productIds.map((id) => new Types.ObjectId(id));
      const products = await this.productModel
        .find({ _id: { $in: objectIds } })
        .lean()
        .exec();
      return products.map(serializeProduct);
    } catch (err) {
      throw new Error(`Failed to fetch products: ${err}`);
    }
  }

  /**
   * Checks that a product exists and has enough stock for the requested quantity.
   * @param productId - MongoDB ObjectId string of the product
   * @param quantity - Number of units requested
   */
  async assertStockAvailable(productId: string, quantity: number): Promise<boolean> {
    try {
      const product = await this.productModel.findById(productId).lean().exec();

      if (!product || product.quantity < quantity) {
        return false;
      }

      return true;
    } catch (err) {
      throw new Error(`Failed to fetch product "${productId}": ${err}`);
    }
  }

  async getCatalogs(): Promise<CatalogDto[]> {
    try {
      const catalogs = (await this.catalogModel.find().lean().exec()) as ICatalog[];
      return catalogs.map(serializeCatalog);
    } catch (err) {
      throw new Error(`Failed to fetch catalogs: ${err}`);
    }
  }
}

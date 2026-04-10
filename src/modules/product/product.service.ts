import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

import { ErrorCode } from '../../common/response/error-code.enum';
import { ProductRepository } from './product.repository';
import { CatalogDto } from './dto/catalog.dto';
import { ProductDto } from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  /**
   * Returns all catalogs.
   */
  async getCatalogs(): Promise<CatalogDto[]> {
    try {
      return await this.productRepository.getCatalogs();
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to fetch catalogs' });
    }
  }

  /**
   * Returns products of a catalog with pagination.
   * @param catalogId - MongoDB ObjectId of the catalog
   * @param limit - Maximum number of products to return
   * @param offset - Number of products to skip
   */
  async getCatalogProducts(catalogId: string, limit: number, offset: number): Promise<ProductDto[]> {
    try {
      const catalog = await this.productRepository.findCatalogById(catalogId);

      if (!catalog) {
        throw new NotFoundException({ code: ErrorCode.CATALOG_NOT_FOUND, message: 'Catalog not found' });
      }

      return await this.productRepository.findByCatalogId(catalogId, limit, offset);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to fetch catalog products',
      });
    }
  }

  /**
   * Returns a single product by its id.
   * @param productId - MongoDB ObjectId of the product
   */
  async getProduct(productId: string): Promise<ProductDto> {
    try {
      const product = await this.productRepository.findProductById(productId);

      if (!product) {
        throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Product not found' });
      }

      return product;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to fetch product' });
    }
  }
}

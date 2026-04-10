import { Controller, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ProductService } from './product.service';
import { CatalogDto, GetCatalogParamDto } from './dto/catalog.dto';
import { GetProductParamDto, ProductDto } from './dto/product.dto';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';

@ApiTags('Catalog')
@Controller('catalog')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Returns all available catalogs.
   */
  @Get()
  @ApiOkResponse({
    description: 'List of all catalogs.',
    type: CatalogDto,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  async getCatalogs(): Promise<CatalogDto[]> {
    return await this.productService.getCatalogs();
  }

  /**
   * Returns a paginated list of products belonging to the specified catalog.
   * @param catalogId - MongoDB ObjectId of the catalog
   * @param query - Pagination parameters (limit, offset)
   */
  @Get(':catalogId/products')
  @ApiOkResponse({
    description: 'Paginated list of products in the catalog.',
    type: ProductDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'Catalog not found.' })
  @HttpCode(HttpStatus.OK)
  async getCatalogProducts(
    @Param() dto: GetCatalogParamDto,
    @Query() query: PaginationQueryDto,
  ): Promise<ProductDto[]> {
    return await this.productService.getCatalogProducts(dto.catalogId, query.limit, query.offset);
  }

  /**
   * Returns a single product by its id.
   * @param productId - MongoDB ObjectId of the product
   */
  @Get('products/:productId')
  @ApiOkResponse({
    description: 'Product details.',
    type: ProductDto,
    isArray: false,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @HttpCode(HttpStatus.OK)
  async getProduct(@Param() dto: GetProductParamDto): Promise<ProductDto> {
    return await this.productService.getProduct(dto.productId);
  }
}

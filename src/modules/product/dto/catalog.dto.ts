import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetCatalogParamDto {
  @ApiProperty({
    name: 'catalogId',
    type: String,
    description: 'Catalog ID',
    example: '6650f1e2a1b2c3d4e5f60002',
  })
  @IsString()
  catalogId: string;
}

export class CatalogDto {
  @ApiProperty({
    name: '_id',
    type: String,
    description: 'MongoDB ObjectId of the catalog',
    example: '6650f1e2a1b2c3d4e5f60001',
  })
  id: string;

  @ApiProperty({
    name: 'name',
    type: String,
    description: 'Catalog name',
    example: 'Electronics',
  })
  name: string;

  @ApiProperty({
    name: 'description',
    type: String,
    description: 'Catalog description',
    example: 'All electronic devices and accessories',
  })
  description: string;
}

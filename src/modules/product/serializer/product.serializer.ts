import { IProduct } from '../../../clients/mongo/models/product.model';
import { ProductDto } from '../dto/product.dto';

export const serializeProduct = (product: IProduct): ProductDto => ({
  id: String(product._id),
  catalogId: String(product.catalogId),
  name: product.name,
  description: product.description,
  price: product.price,
  quantity: product.quantity,
  attributes: product.attributes,
});

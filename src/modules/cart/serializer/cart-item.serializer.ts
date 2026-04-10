import { CartItemDto } from '../dto/cart-item.dto';
import { StoredCartItemDto } from '../dto/stored-cart-item.dto';

export const deserializeStoredCartItem = (json: string): StoredCartItemDto => {
  const parsed = JSON.parse(json);
  return {
    name: String(parsed.name),
    description: String(parsed.description),
    price: Number(parsed.price),
    quantity: Number(parsed.quantity),
  };
};

export const serializeCartItem = (productId: string, stored: StoredCartItemDto): CartItemDto => ({
  productId,
  name: stored.name,
  description: stored.description,
  price: stored.price,
  quantity: stored.quantity,
});

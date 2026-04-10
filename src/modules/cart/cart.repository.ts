import { Injectable } from '@nestjs/common';

import { RedisService } from 'src/clients/redis/redis.service';

import { CartItemDto } from './dto/cart-item.dto';
import { StoredCartItemDto } from './dto/stored-cart-item.dto';
import { deserializeStoredCartItem, serializeCartItem } from './serializer/cart-item.serializer';

@Injectable()
export class CartRepository {
  private static readonly CART_TTL_SECONDS = 86400;
  constructor(private readonly redisService: RedisService) {}

  private getKey(userId: string): string {
    return `cart:${userId}`;
  }

  private parseItems(raw: Record<string, string>): CartItemDto[] {
    return Object.entries(raw).map(([productId, json]) =>
      serializeCartItem(productId, deserializeStoredCartItem(json)),
    );
  }

  /**
   * Adds a product to the cart (or increments quantity if already present). Resets the cart TTL.
   * Product snapshot (name, description, price) is stored alongside quantity so reads need no DB lookup.
   * @param userId - The user ID
   * @param productId - The product to add
   * @param quantity - Number of units to add
   * @param product - Product snapshot stored with the item
   * @returns Updated list of cart items
   */
  async addItem(
    userId: string,
    productId: string,
    quantity: number,
    product: { name: string; description: string; price: number },
  ): Promise<CartItemDto[]> {
    try {
      const key = this.getKey(userId);
      const current = await this.redisService.hget(key, productId);
      const currentQuantity = current ? deserializeStoredCartItem(current).quantity : 0;
      const stored: StoredCartItemDto = {
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: currentQuantity + quantity,
      };

      await Promise.all([
        this.redisService.hset(key, productId, JSON.stringify(stored)),
        this.redisService.expire(key, CartRepository.CART_TTL_SECONDS),
      ]);

      const raw = await this.redisService.hgetall(key);
      return this.parseItems(raw || {});
    } catch (err) {
      throw new Error(`Failed to add item "${productId}" to cart for user "${userId}": ${err}`);
    }
  }

  /**
   * Removes units of a product from the cart.
   * If `quantity` is omitted or the result drops to zero, the product is removed entirely.
   * @param userId - The user ID
   * @param productId - The product to remove
   * @param quantity - Units to decrement; omit to remove the product entirely
   * @returns Updated list of cart items
   */
  async removeItem(userId: string, productId: string, quantity?: number): Promise<CartItemDto[]> {
    try {
      const key = this.getKey(userId);

      if (quantity === undefined) {
        await this.redisService.hdel(key, productId);
      } else {
        const current = await this.redisService.hget(key, productId);

        if (current) {
          const stored = deserializeStoredCartItem(current);
          const newQuantity = stored.quantity - quantity;

          if (newQuantity <= 0) {
            await this.redisService.hdel(key, productId);
          } else {
            await Promise.all([
              this.redisService.hset(key, productId, JSON.stringify({ ...stored, quantity: newQuantity })),
              this.redisService.expire(key, CartRepository.CART_TTL_SECONDS),
            ]);
          }
        }
      }

      const raw = await this.redisService.hgetall(key);
      return this.parseItems(raw || {});
    } catch (err) {
      throw new Error(`Failed to remove item "${productId}" from cart for user "${userId}": ${err}`);
    }
  }

  /**
   * Returns all items in the user's cart.
   * @param userId - The user ID
   * @returns List of cart items
   */
  async getCart(userId: string): Promise<CartItemDto[]> {
    try {
      const raw = await this.redisService.hgetall(this.getKey(userId));
      return this.parseItems(raw || {});
    } catch (err) {
      throw new Error(`Failed to get cart for user "${userId}": ${err}`);
    }
  }

  /**
   * Deletes the entire cart for a user.
   * @param userId - The user ID
   */
  async clearCart(userId: string): Promise<void> {
    try {
      await this.redisService.del(this.getKey(userId));
    } catch (err) {
      throw new Error(`Failed to clear cart for user "${userId}": ${err}`);
    }
  }
}

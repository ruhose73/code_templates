import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ErrorCode } from 'src/common/response/error-code.enum';
import { ProductRepository } from '../product/product.repository';
import { CartRepository } from './cart.repository';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  /**
   * Adds a product to the user's cart (or increments quantity if already present).
   * Fetches the product from MongoDB once to validate stock and snapshot the data.
   * Subsequent reads (getCart, removeItem) are served entirely from Redis.
   * @param userId - Authenticated user ID
   * @param dto - Add item payload
   */
  async addItem(userId: string, dto: AddCartItemDto): Promise<CartItemDto[]> {
    try {
      const product = await this.productRepository.findProductById(dto.productId);

      if (!product) {
        throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Product not found' });
      }

      if (product.quantity < dto.quantity) {
        throw new BadRequestException({ code: ErrorCode.INSUFFICIENT_STOCK, message: 'Insufficient stock' });
      }

      return await this.cartRepository.addItem(userId, dto.productId, dto.quantity, {
        name: product.name,
        description: product.description,
        price: product.price,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to add item to cart' });
    }
  }

  /**
   * Removes units of a product from the cart.
   * Passing no quantity removes the product entirely.
   * @param userId - Authenticated user ID
   * @param productId - Product to remove
   * @param quantity - Units to decrement; omit to remove entirely
   */
  async removeItem(userId: string, productId: string, quantity?: number): Promise<CartItemDto[]> {
    try {
      return await this.cartRepository.removeItem(userId, productId, quantity);
    } catch {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to remove item from cart',
      });
    }
  }

  /**
   * Returns all items in the user's cart.
   * @param userId - Authenticated user ID
   */
  async getCart(userId: string): Promise<CartItemDto[]> {
    try {
      return await this.cartRepository.getCart(userId);
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to get cart' });
    }
  }

  /**
   * Clears the entire cart for the user.
   * @param userId - Authenticated user ID
   */
  async clearCart(userId: string): Promise<void> {
    try {
      await this.cartRepository.clearCart(userId);
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to clear cart' });
    }
  }
}

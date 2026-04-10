import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, JwtPayload } from '../../common/auth/jwt.strategy';

import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { RemoveCartItemQueryDto } from './dto/remove-cart-item-query.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { GetProductParamDto } from '../product/dto/product.dto';

@ApiTags('Cart')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Returns the current user's cart.
   * @param req - Authenticated request with JWT payload
   */
  @Get()
  @ApiOkResponse({ description: 'Returns the current cart.', type: CartItemDto, isArray: true })
  @HttpCode(HttpStatus.OK)
  async getCart(@Req() req: { user: JwtPayload }): Promise<CartItemDto[]> {
    return this.cartService.getCart(req.user.sub);
  }

  /**
   * Adds a product to the cart. Increments quantity if the product is already present.
   * @param req - Authenticated request with JWT payload
   * @param dto - Add item payload
   */
  @Post('items')
  @ApiOkResponse({ description: 'Returns the updated cart.', type: CartItemDto, isArray: true })
  @HttpCode(HttpStatus.OK)
  async addItem(@Req() req: { user: JwtPayload }, @Body() dto: AddCartItemDto): Promise<CartItemDto[]> {
    return this.cartService.addItem(req.user.sub, dto);
  }

  /**
   * Removes units of a product from the cart.
   * Pass `?quantity=N` to decrement by N; omit to remove the product entirely.
   * @param req - Authenticated request with JWT payload
   * @param productId - Product ID to remove
   * @param query - Optional quantity to decrement
   */
  @Delete('items/:productId')
  @ApiOkResponse({ description: 'Returns the updated cart.', type: CartItemDto, isArray: true })
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Req() req: { user: JwtPayload },
    @Param() dto: GetProductParamDto,
    @Query() query: RemoveCartItemQueryDto,
  ): Promise<CartItemDto[]> {
    return this.cartService.removeItem(req.user.sub, dto.productId, query.quantity);
  }

  /**
   * Clears the entire cart.
   * @param req - Authenticated request with JWT payload
   */
  @Delete()
  @ApiNoContentResponse({ description: 'Cart cleared.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(@Req() req: { user: JwtPayload }): Promise<void> {
    return this.cartService.clearCart(req.user.sub);
  }
}

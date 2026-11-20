import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { OrderStatus } from '@barit/shared';

export class PlaceOrderItemDto {
  @IsString() portionId: string;
  @IsInt() @Min(1) @Max(50) qty: number;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

export class PlaceOrderDto {
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: PlaceOrderItemDto[];

  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsString() @MaxLength(60) guestName?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(['ORDERED', 'COOKING', 'READY', 'SERVED', 'CANCELLED'])
  status: OrderStatus;
}

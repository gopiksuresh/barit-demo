import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(28) gstRatePct?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(28) gstRatePct?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class ReorderDto {
  @IsArray() @IsString({ each: true }) @ArrayMaxSize(500) ids: string[];
}

export class PortionInputDto {
  /** Existing portion id to update; omit to create. */
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(30) label: string;
  @IsInt() @Min(0) @Max(10_000_000) pricePaise: number;
}

/** Image URL: relative /uploads/... in dev, or an https URL (Firebase Storage, demo images). */
const IMAGE_URL = /^(\/(uploads|demo)\/[\w.\-\/]+|https:\/\/\S+)$/;

export class CreateItemDto {
  @IsString() categoryId: string;
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsString() @Matches(IMAGE_URL) imageUrl?: string | null;
  @IsOptional() @IsBoolean() isVeg?: boolean;
  @IsOptional() @IsBoolean() isSpecial?: boolean;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;

  @ValidateNested({ each: true })
  @Type(() => PortionInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  portions: PortionInputDto[];
}

export class UpdateItemDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string | null;
  @IsOptional() @IsString() @Matches(IMAGE_URL) imageUrl?: string | null;
  @IsOptional() @IsBoolean() isVeg?: boolean;
  @IsOptional() @IsBoolean() isSpecial?: boolean;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PortionInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  portions?: PortionInputDto[];
}

export class TableDto {
  @IsInt() @Min(1) @Max(999) number: number;
  @IsOptional() @IsInt() @Min(1) @Max(40) seats?: number;
}

export class UpdateTableDto {
  @IsOptional() @IsInt() @Min(1) @Max(999) number?: number;
  @IsOptional() @IsInt() @Min(1) @Max(40) seats?: number;
}

export class MarkPaidDto {
  @IsIn(['CASH', 'CARD']) method: 'CASH' | 'CARD';
  @IsOptional() @IsInt() @Min(0) tipPaise?: number;
}

export class VenueSettingsDto {
  @IsOptional() @IsBoolean() isOpen?: boolean;
}

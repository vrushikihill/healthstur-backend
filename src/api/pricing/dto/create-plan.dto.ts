import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  durationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  price: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  prices?: Record<string, string>;

  @ApiProperty()
  @IsArray()
  features: string[];

  @ApiProperty()
  @IsArray()
  support: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  highlighted?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  buttonText?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

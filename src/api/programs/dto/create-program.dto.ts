import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class SolutionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  approach?: string;

  @IsString()
  @IsOptional()
  benefits?: string;

  @IsString()
  @IsNotEmpty()
  priceIndia: string;

  @IsString()
  @IsNotEmpty()
  priceUsa: string;

  @IsString()
  @IsNotEmpty()
  priceEurope: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  iconColor?: string;

  @IsString()
  @IsNotEmpty()
  href: string;

  @IsString()
  @IsNotEmpty()
  heading: string;

  @IsString()
  @IsNotEmpty()
  subtext: string;

  @IsString()
  @IsOptional()
  background?: string;

  @IsString()
  @IsOptional()
  homeHeading?: string;

  @IsString()
  @IsOptional()
  homeSubtext?: string;

  @IsString()
  @IsOptional()
  homeBackground?: string;

  @IsString()
  @IsOptional()
  solutionsHeading?: string;

  @IsString()
  @IsOptional()
  solutionsSubtext?: string;

  @IsArray()
  @IsOptional()
  bullets?: string[];

  @IsArray()
  @IsOptional()
  subItems?: any[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolutionDto)
  @IsOptional()
  solutions?: SolutionDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Curated Track Fields
  @IsBoolean()
  @IsOptional()
  isCurated?: boolean;

  @IsString()
  @IsOptional()
  curatedTitle?: string;

  @IsString()
  @IsOptional()
  curatedDescription?: string;

  @IsString()
  @IsOptional()
  curatedImage?: string;

  @IsString()
  @IsOptional()
  curatedIcon?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  curatedIconWidth?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  curatedIconHeight?: number;

  @IsString()
  @IsOptional()
  curatedLinkText?: string;
}

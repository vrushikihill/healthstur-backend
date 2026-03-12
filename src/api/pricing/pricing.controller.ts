import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreateDurationDto } from './dto/create-duration.dto';
import { UpdateDurationDto } from './dto/update-duration.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // PUBLIC ENDPOINT
  @Get('public')
  getPublicPricing() {
    return this.pricingService.getPublicPricing();
  }

  // DURATIONS (Admin)
  @UseGuards(AuthGuard('jwt'))
  @Post('durations')
  createDuration(@Body() createDurationDto: CreateDurationDto) {
    return this.pricingService.createDuration(createDurationDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('durations')
  findAllDurations() {
    return this.pricingService.findAllDurations();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('durations/reorder')
  reorderDurations(@Body('orders') orders: { id: string; order: number }[]) {
    return this.pricingService.reorderDurations(orders);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('durations/:id')
  findOneDuration(@Param('id') id: string) {
    return this.pricingService.findOneDuration(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('durations/:id')
  updateDuration(
    @Param('id') id: string,
    @Body() updateDurationDto: UpdateDurationDto,
  ) {
    return this.pricingService.updateDuration(id, updateDurationDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('durations/:id')
  removeDuration(@Param('id') id: string) {
    return this.pricingService.removeDuration(id);
  }

  // PLANS (Admin)
  @UseGuards(AuthGuard('jwt'))
  @Post('plans')
  createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.pricingService.createPlan(createPlanDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('plans')
  findAllPlans() {
    return this.pricingService.findAllPlans();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('plans/reorder')
  reorderPlans(@Body('orders') orders: { id: string; order: number }[]) {
    return this.pricingService.reorderPlans(orders);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('plans/:id')
  findOnePlan(@Param('id') id: string) {
    return this.pricingService.findOnePlan(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
    return this.pricingService.updatePlan(id, updatePlanDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('plans/:id')
  removePlan(@Param('id') id: string) {
    return this.pricingService.removePlan(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Res,
  Req,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}
  @Post('test-email')
  testEmail(@Body() body: { email: string; name?: string }) {
    if (!body.email) {
      return {
        success: false,
        message: 'Please provide an email field in JSON.',
      };
    }
    return this.applicationsService.testEmail(body.email, body.name);
  }

  @Post()
  create(@Body() createApplicationDto: CreateApplicationDto) {
    return this.applicationsService.create(createApplicationDto);
  }

  @Post(':id/refund')
  refund(@Param('id') id: string) {
    return this.applicationsService.refund(id);
  }

  @Post('webhook')
  async handleWebhook(@Req() req: any, @Headers() headers: any) {
    return this.applicationsService.handleWebhook(req, headers);
  }

  @Post('verify-payment')
  verifyPayment(@Body() body: any) {
    return this.applicationsService.verifyPayment(body);
  }

  @Get()
  findAll() {
    return this.applicationsService.findAll();
  }

  @Get(':id/invoice')
  async downloadInvoice(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.applicationsService.generateInvoicePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applicationsService.remove(id);
  }
}

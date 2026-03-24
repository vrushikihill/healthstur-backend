import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { CompanyInfoService } from './company-info.service';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadImageToS3 } from '../../utils/s3.util';

@Controller('company-info')
export class CompanyInfoController {
  constructor(private readonly companyInfoService: CompanyInfoService) {}

  @Get()
  getInfo() {
    return this.companyInfoService.getInfo();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put()
  updateInfo(@Body() updateDto: UpdateCompanyInfoDto) {
    return this.companyInfoService.updateInfo(updateDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const url = await uploadImageToS3(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return { url };
  }
}

import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

export function LocalFileFieldsInterceptor(
  fields: { name: string; maxCount: number }[],
) {
  return applyDecorators(UseInterceptors(FileFieldsInterceptor(fields)));
}

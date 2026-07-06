import { Module } from '@nestjs/common';

import { SecModule } from './sec/sec.module';

@Module({
  imports: [SecModule],
})
export class AppModule {}

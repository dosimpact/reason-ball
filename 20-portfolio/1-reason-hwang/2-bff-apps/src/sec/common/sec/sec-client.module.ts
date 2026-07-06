import { Global, Module } from '@nestjs/common';
import { SecClientService } from './sec-client.service';

@Global()
@Module({
  providers: [SecClientService],
  exports: [SecClientService],
})
export class SecClientModule {}

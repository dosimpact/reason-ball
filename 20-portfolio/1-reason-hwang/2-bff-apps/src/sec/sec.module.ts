import { Module } from '@nestjs/common';

import { CollectorController } from './api/collector.controller';
import { CompaniesSyncModule } from './companies-sync/companies-sync.module';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/db/database.module';
import { SecClientModule } from './common/sec/sec-client.module';
import { FilingsCollectorModule } from './filings-collector/filings-collector.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SecClientModule,
    CompaniesSyncModule,
    FilingsCollectorModule,
  ],
  controllers: [CollectorController],
})
export class SecModule {}

import { SecModelingController } from './sec-modeling.controller';
import { SecModelingService } from './service/sec-modeling.service';
import { SecModelingStore } from './service/sec-modeling.store';
import { SecModelingExecutor } from './service/sec-modeling.executor';
import { SecModelingClient } from '../lib/sec-modeling/sec-modeling.client';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, AppConfigService } from '../shared/config.service';
import { SecClientService } from '../lib/sec/sec.client';
import { Company } from './entity/company.entity';
import { Filing } from './entity/filing.entity';
import { CompanyService } from './service/company.service';
import { FilingService } from './service/filing.service';
import { FilingBackfillService } from './service/filing-backfill.service';
import { UsCorporateFilingsController } from './us-corporate-filings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Filing])],
  controllers: [UsCorporateFilingsController, SecModelingController],
  providers: [
    { provide: AppConfigService, useValue: appConfig },
    SecClientService, CompanyService, FilingService, FilingBackfillService,
    SecModelingService, SecModelingStore, SecModelingExecutor, SecModelingClient,
  ],
})
export class UsCorporateFilingsModule { }

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../common/db/entities/company.entity';
import { Filing } from '../common/db/entities/filing.entity';
import { FilingsCollectorService } from './filings-collector.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Filing])],
  providers: [FilingsCollectorService],
  exports: [FilingsCollectorService],
})
export class FilingsCollectorModule {}

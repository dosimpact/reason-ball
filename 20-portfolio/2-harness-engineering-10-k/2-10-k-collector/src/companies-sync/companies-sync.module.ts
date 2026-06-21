import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../common/db/entities/company.entity';
import { CompaniesSyncService } from './companies-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [CompaniesSyncService],
  exports: [CompaniesSyncService],
})
export class CompaniesSyncModule {}

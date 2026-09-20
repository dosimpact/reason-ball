import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, AppConfigService } from './shared/config.service';
import { UsCorporateFilingsModule } from './us-corporate-filings/us-corporate-filings.module';
import { InitialCollectorSchema1730000000000 } from './us-corporate-filings/migrations/1730000000000-initial-collector-schema';
import { SecTwentyYearBackfill1787589300000 } from './us-corporate-filings/migrations/1787589300000-sec-twenty-year-backfill';
import { FilingSourceDefault1787589400000 } from './us-corporate-filings/migrations/1787589400000-filing-source-default';
import { FilingDatabaseContent1790000000000 } from './us-corporate-filings/migrations/1790000000000-filing-database-content';


@Module({
  imports: [TypeOrmModule.forRootAsync({
    useFactory: () => {
      const config = appConfig;
      const useUrl = config.databaseUrl.length > 0;
      return {
        type: 'postgres' as const,
        url: useUrl ? config.databaseUrl : undefined,
        host: useUrl ? undefined : config.postgresHost,
        port: useUrl ? undefined : config.postgresPort,
        username: useUrl ? undefined : config.postgresUser,
        password: useUrl ? undefined : config.postgresPassword,
        database: useUrl ? undefined : config.postgresDb,
        autoLoadEntities: true,
        migrations: [
          InitialCollectorSchema1730000000000,
          SecTwentyYearBackfill1787589300000,
          FilingSourceDefault1787589400000,
          FilingDatabaseContent1790000000000,
        ],
        migrationsRun: true,
        synchronize: false,
        logging: false,
      };
    }
  }), UsCorporateFilingsModule],
  providers: [{ provide: AppConfigService, useValue: appConfig }],
})
export class AppModule { }

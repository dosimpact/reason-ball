import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app.config';
import { InitialCollectorSchema1730000000000 } from './migrations/1730000000000-initial-collector-schema';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
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
          migrations: [InitialCollectorSchema1730000000000],
          migrationsRun: true,
          synchronize: false,
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

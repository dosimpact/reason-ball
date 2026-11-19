import { Module } from '@nestjs/common';
import { appConfig, AppConfigService } from '../shared/config.service';
import { DartClient } from '../lib/dart/dart.client';
import { OpenDartController } from './open-dart.controller';

@Module({ controllers: [OpenDartController], providers: [DartClient, { provide: AppConfigService, useValue: appConfig }] })
export class OpenDartModule { }

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramModule } from './telegram/telegram.module';
import { PendingUidRequest } from './storage/entities/pending-uid-request.entity';
import { UserStep } from './storage/entities/user-step.entity';
import { VerifiedUser } from './storage/entities/verified-user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [VerifiedUser, PendingUidRequest, UserStep],
        synchronize: true,
      }),
    }),
    TelegramModule,
  ],
})
export class AppModule {}

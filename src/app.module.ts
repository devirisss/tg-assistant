import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.get<string>('REDIS_URL'));

        return {
          redis: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port),
            password: redisUrl.password || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BotModule,
  ],
})
export class AppModule {}

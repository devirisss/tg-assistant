import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BullModule } from '@nestjs/bull';
import { QueueName as MessageQueueName, BotProcessor } from './queue/message.processor';
import { GroqModule } from 'src/groq/groq.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GigaChatModule } from 'src/gigachat/gigachat.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MessageQueueName, settings: {
        lockDuration: 120 * 1000,
        maxStalledCount: 3,
      },
    }),
    GroqModule,
    GigaChatModule,
    PrismaModule,
  ],
  providers: [
    BotService,
    BotProcessor,
  ],
  exports: [
    BotService,
  ]
})
export class BotModule {}

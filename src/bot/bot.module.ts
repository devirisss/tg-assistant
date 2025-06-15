import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { GigaChatModule } from 'src/gigachat/gigachat.module';
import { BullModule } from '@nestjs/bull';
import { QueueName as MessageQueueName, BotProcessor } from './queue/message.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: MessageQueueName }),
    GigaChatModule,
  ],
  providers: [
    BotService,
    BotProcessor,
  ],
})
export class BotModule {}

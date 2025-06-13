import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { GroqModule } from 'src/groq/groq.module';
import { BullModule } from '@nestjs/bull';
import { QueueName as MessageQueueName, BotProcessor } from './queue/message.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: MessageQueueName }),
    GroqModule
  ],
  providers: [
    BotService,
    BotProcessor
  ],
})
export class BotModule {}

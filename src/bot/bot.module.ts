import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { GroqModule } from 'src/groq/groq.module';

@Module({
  imports: [GroqModule],
  providers: [BotService],
})
export class BotModule {}

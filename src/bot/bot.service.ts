import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName as MessageQueueName } from './queue/message.processor';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;

  constructor(
    @InjectQueue(MessageQueueName) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);

    this.bot.on('text', async (ctx) => {
      const userMessage = ctx.message.text || '';
      const chatId = ctx.chat.id;

      await this.queue.add(
        { message: userMessage, chatId },
        {
          attempts: 5,
          backoff: 3 * 1000,
          removeOnFail: true,
          removeOnComplete: true,
        }
      );

      await ctx.reply('Думаю...');
    });

    await this.bot.launch();
  }
}

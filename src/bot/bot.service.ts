import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { GroqService } from '../groq/groq.service';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;

  constructor(private readonly groqService: GroqService) {}

  async onModuleInit() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);

    this.bot.on('text', async (ctx) => {
      const userMessage = ctx.message.text || '';

      const response = await this.groqService.askGroq(userMessage);
      await ctx.reply(response || 'Что-то пошло не так...', {
        parse_mode: 'Markdown',
      });
    });

    await this.bot.launch();
  }
}

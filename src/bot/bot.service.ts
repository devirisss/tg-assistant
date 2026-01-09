import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName as MessageQueueName } from './queue/message.processor';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;

  constructor(
    @InjectQueue(MessageQueueName) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);

    this.queue.on('completed', async (job, result) => {
      await this.sendMessageToChat(result, job.data.chatId, job.data.messages);
    });

    this.queue.on('failed', async (job, error) => {
      if (!job) return;
      const { chatId, messages, model } = job.data;

      if (job.attemptsMade === job.opts.attempts) {
        if (model === 'groq') {
          await this.sendMessageToChat(
            'Groq временно недоступен. Переключаюсь на GigaChat…',
            chatId,
          );

          await this.queue.add(
            {
              messages,
              chatId,
              model: 'gigachat',
            },
            {
              attempts: 3,
              backoff: 3000,
              removeOnComplete: true,
              removeOnFail: true,
            }
          );

          return;
        }

        await this.sendMessageToChat(`Все модели сейчас недоступны: ${error.message}`, job.data.chatId);
      }
    });

    this.bot.on('text', async (ctx) => {
      const userMessage = ctx.message.text || '';
      const chatId = ctx.chat.id;

      const messages = await this.prepareMessages(userMessage, chatId);

      await ctx.reply('Думаю...');

      await this.queue.add(
        { messages, chatId, model: 'groq' },
        {
          timeout: 60 * 1000,
          attempts: 3,
          backoff: 3 * 1000,
          removeOnFail: true,
          removeOnComplete: true,
        }
      );
    });

    await this.bot.launch();
  }

  async prepareMessages(userMessage: string, chatId: number) {
    const history = await this.prisma.message.findMany({
      where: {
        chatId,
      },
      select: {
        role: true,
        content: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const messages = [
      ...history.reverse().map(message => ({
        role: message.role.toLocaleLowerCase(),
        content: message.content,
      })),
      { role: 'user', content: userMessage },
    ];

    return messages;
  }

  async sendMessageToChat(message: string, chatId: number, history?: { role: 'user' | 'assistant' | 'system', content: string }[]) {
    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      if (history) {
        await this.saveMessages(message, chatId, history);
      }
    } catch (error) {
      await this.bot.telegram.sendMessage(chatId, `Что-то пошло не так: ${error.message}`);
    }
  }

  async saveMessages(message: string, chatId: number, history: { role: 'user' | 'assistant' | 'system', content: string }[]) {
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatId,
          content: history[history.length - 1].content,
          role: Role.USER,
        },
      }),
      this.prisma.message.create({
        data: {
          chatId,
          content: message,
          role: Role.ASSISTANT,
        },
      }),
    ]);
  }
}

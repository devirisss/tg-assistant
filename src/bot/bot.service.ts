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

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Начать работу с ботом' },
    ]);

    this.queue.on('completed', async (job, result) => {
      try {
        if (job.data.thinkingMessageId) {
          try {
            await this.bot.telegram.deleteMessage(job.data.chatId, job.data.thinkingMessageId);
          } catch (error) {
            console.error('Error deleting thinking message:', error);
          }
        }
        await this.sendMessageToChat(result, job.data.chatId, job.data.messages);
      } catch (error) {
        console.error('Error in completed handler:', error);
        await this.sendServiceError(job.data.chatId);
      }
    });

    this.queue.on('failed', async (job, error) => {
      if (!job) return;
      const { chatId, messages, model, thinkingMessageId } = job.data;

      if (thinkingMessageId) {
        try {
          await this.bot.telegram.deleteMessage(chatId, thinkingMessageId);
        } catch (err) {
          console.error('Error deleting thinking message on failure:', err);
        }
      }

      if (job.attemptsMade === job.opts.attempts) {
        try {
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
                backoff: 3 * 1000,
                removeOnComplete: true,
                removeOnFail: true,
              }
            );

            return;
          }

          await this.sendServiceError(chatId);
        } catch (err) {
          console.error('Error handling failed job:', err);
          await this.sendServiceError(chatId);
        }
      }
    });

    this.bot.command('start', async (ctx) => {
      const chatId = ctx.chat.id;
      await this.sendWelcomeMessage(chatId);
    });

    this.bot.on('text', async (ctx) => {
      try {
        const userMessage = ctx.message.text || '';
        const chatId = ctx.chat.id;

        const isNewUser = await this.isNewUser(chatId);
        if (isNewUser) {
          await this.sendWelcomeMessage(chatId);
        }

        const messages = await this.prepareMessages(userMessage, chatId);

        const thinkingMessage = await ctx.reply('Думаю...');

        await this.queue.add(
          { messages, chatId, model: 'groq', thinkingMessageId: thinkingMessage.message_id },
          {
            timeout: 60 * 1000,
            attempts: 3,
            backoff: 3 * 1000,
            removeOnFail: true,
            removeOnComplete: true,
          }
        );
      } catch (error) {
        console.error('Error processing text message:', error);
        try {
          await this.sendServiceError(ctx.chat.id);
        } catch (err) {
          console.error('Error sending service error message:', err);
        }
      }
    });

    await this.bot.launch();
  }

  async isNewUser(chatId: number): Promise<boolean> {
    const messageCount = await this.prisma.message.count({
      where: { chatId },
    });
    return messageCount === 0;
  }

  async sendWelcomeMessage(chatId: number) {
    const welcomeText = 'Привет! Я телеграм бот, который может ответить на любой вопрос. Просто напиши мне что-нибудь, и я постараюсь помочь!';
    try {
      await this.bot.telegram.sendMessage(chatId, welcomeText);
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
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
      console.error('Error in sendMessageToChat:', error);
      await this.sendServiceError(chatId);
    }
  }

  async sendServiceError(chatId: number) {
    try {
      await this.bot.telegram.sendMessage(chatId, 'Ошибка сервиса');
    } catch (error) {
      console.error('Error sending service error message:', error);
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

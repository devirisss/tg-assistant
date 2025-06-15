import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Telegraf } from 'telegraf';
import { GigaChatService } from '../../gigachat/gigachat.service';
import { ConfigService } from '@nestjs/config';

export const QueueName = 'message-reply';

@Processor(QueueName)
export class BotProcessor {
    private bot: Telegraf;

    constructor(
        private readonly gigachatService: GigaChatService,
        private readonly configService: ConfigService,
    ) {
        this.bot = new Telegraf(this.configService.get<string>(
            'BOT_TOKEN',
        ));
    }

    @Process({ concurrency: 5 })
    async handleReply(job: Job<{ message: string; chatId: number }>) {
        const { message, chatId } = job.data;
        try {
            const response = await this.gigachatService.askGigachat(message);
            await this.bot.telegram.sendMessage(chatId, response || 'Что-то пошло не так...', {
                parse_mode: 'Markdown',
            });
        } catch (error) {
            throw error;
        }
    }

    @OnQueueFailed()
    async onFailed(job: Job, error: Error) {
        console.error(`Job ${job.id} failed:`, error);
    }
}

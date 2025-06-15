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
        const response = await this.gigachatService.askGigachat(message);
        if (!response) {
            throw new Error;
        }
        await this.bot.telegram.sendMessage(chatId, response, {
            parse_mode: 'Markdown',
        });
    }

    @OnQueueFailed()
    async onFailed(job: Job, error: Error) {
        if (job.attemptsMade === job.opts.attempts) {
            await this.bot.telegram.sendMessage(job.data.chatId, 'Что-то пошло не так...');
            console.error(error);
        }
    }
}

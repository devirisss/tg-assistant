import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { GroqService } from '../../groq/groq.service';
import { GigaChatService } from '../../gigachat/gigachat.service';

export const QueueName = 'message-reply';

@Processor(QueueName)
export class BotProcessor {

    constructor(
        private readonly groqService: GroqService,
        private readonly gigaChatService: GigaChatService
    ) {}

    @Process({ concurrency: 1 })
    async handleReply(job: Job<{ messages: { role: 'user' | 'assistant' | 'system', content: string }[]; chatId: number; model: 'groq' | 'gigachat' }>) {
        try {
            const { messages, chatId } = job.data;

            const systemMessage = {
                role: 'system',
                content:
                    'Ты умный и дружелюбный Telegram-бот.' +
                    'Отвечай ТОЛЬКО в Markdown, совместимом с Telegram API.' +
                    'НЕ используй таблицы в своем ответе.' +
                    'СТРОГО следуй теме вопроса, отвечай кратко, БЕЗ воды.' +
                    'Максимальная длина твоего ответа - 4000 символов.'
            } as const;

            let response: string;

            if (job.data.model === 'groq') {
                response = await this.groqService.sendMessage([systemMessage, ...messages]);
            } else {
                response = await this.gigaChatService.sendMessage([systemMessage, ...messages]);
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    @OnQueueFailed()
    async onFailed(job: Job<{ messages: { role: 'user' | 'assistant' | 'system', content: string }[]; chatId: number }> | null, error: Error) {
        if (job.attemptsMade === job.opts.attempts) {
            console.error(`Job failed after all attempts: ${error.message}`);
        }
    }
}

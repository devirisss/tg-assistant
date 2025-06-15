import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import GigaChat from 'gigachat';

@Injectable()
export class GigaChatService {
  private gigachat: GigaChat;

  constructor(private readonly configService: ConfigService) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    this.gigachat = new GigaChat({
      credentials: this.configService.get<string>('GIGACHAT_AUTH_KEY')
    });
  }

  async askGigachat(message: string): Promise<string | null> {
    try {
      const response = await this.gigachat.chat({
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      return response.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      console.error('GigaChat API Error:', error);
      return null;
    }
  }
}

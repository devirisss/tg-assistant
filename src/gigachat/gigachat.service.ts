import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';

@Injectable()
export class GigaChatService {
  private httpsAgent;
  private gigachat: GigaChat;

  constructor(private readonly configService: ConfigService) {
    this.httpsAgent = new Agent({
      cert: this.configService.get<string>('GIGACHAT_CERT'),
      ca: this.configService.get<string>('GIGACHAT_CA'),
    })
    this.gigachat = new GigaChat({
      credentials: this.configService.get<string>('GIGACHAT_AUTH_KEY'),
      httpsAgent: this.httpsAgent
    });
  }

  async sendMessage(messages: { role: 'user' | 'assistant' | 'system', content: string }[]): Promise<string | null> {
    try {
      const response = await this.gigachat.chat({ messages });
      return response.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      throw new Error(`GigaChat API Error: ${error.message}`);
    }
  }
}

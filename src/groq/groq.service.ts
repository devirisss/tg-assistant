import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Groq } from 'groq-sdk';

@Injectable()
export class GroqService {
  private groq: Groq;

  constructor(private readonly configService: ConfigService) {
    this.groq = new Groq({ apiKey: this.configService.get<string>('GROQ_API_KEY') });
  }
  async sendMessage(messages: { role: 'user' | 'assistant' | 'system', content: string }[]) {
    try {
      const response = await this.groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages,
      });
      return response.choices?.[0]?.message?.content;
    } catch (error) {
      throw new Error(`Qroq API Error: ${error.message}`);
    }
  }
}

import { ApiClient } from './client';

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ReferencedQuote {
  id?: number;
  quote_number: string;
  customer?: string;
}

export interface CopilotResponse {
  reply: string;
  role: string;
  role_title: string;
  referenced_quotes?: ReferencedQuote[];
  priorities_summary?: {
    urgent_count: number;
    high_count: number;
  };
  timestamp: string;
}

export const copilotApi = {
  chat: (message: string, history: CopilotMessage[] = []): Promise<CopilotResponse> => {
    return ApiClient.post<CopilotResponse>('/copilot/chat/', {
      message,
      history,
    });
  },
};

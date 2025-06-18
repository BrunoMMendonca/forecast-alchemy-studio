import { AISettings } from '@/config/settings';

export interface AIQuestion {
  id: string;
  question: string;
  context: any;
  options?: string[];
  type: 'confirmation' | 'choice' | 'input';
}

export interface AIResponse {
  questionId: string;
  answer: string;
  confidence: number;
  explanation?: string;
}

class AIService {
  private settings: AISettings;
  private currentQuestion: AIQuestion | null = null;
  private questionCallbacks: Map<string, (response: AIResponse) => void> = new Map();

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  updateSettings(settings: AISettings) {
    this.settings = settings;
  }

  async askQuestion(question: AIQuestion): Promise<AIResponse> {
    if (!this.settings.enabled) {
      throw new Error('AI service is disabled');
    }

    this.currentQuestion = question;

    return new Promise((resolve) => {
      this.questionCallbacks.set(question.id, resolve);

      // Emit the question to the UI
      const event = new CustomEvent('ai-question', {
        detail: {
          question,
          settings: this.settings
        }
      });
      window.dispatchEvent(event);
    });
  }

  handleUserResponse(response: AIResponse) {
    const callback = this.questionCallbacks.get(response.questionId);
    if (callback) {
      callback(response);
      this.questionCallbacks.delete(response.questionId);
    }
    this.currentQuestion = null;
  }

  async analyzeData(data: any[][], context: any = {}): Promise<AIQuestion[]> {
    if (!this.settings.enabled) {
      return [];
    }

    const questions: AIQuestion[] = [];
    const headers = data[0];
    const sampleRows = data.slice(1, 6); // First 5 rows for analysis

    // Analyze data pattern
    const hasYear = headers.some(h => h.toLowerCase().includes('year'));
    const hasMonth = headers.some(h => h.toLowerCase().includes('month'));
    
    if (hasYear && hasMonth) {
      questions.push({
        id: 'year-month-pattern',
        question: 'I detected Year and Month columns. Would you like me to combine them into a single Date column?',
        context: {
          type: 'year-month',
          headers,
          sampleRows
        },
        type: 'confirmation'
      });
    }

    // Analyze column types
    headers.forEach((header, index) => {
      const values = sampleRows.map(row => row[index]);
      const uniqueValues = new Set(values).size;
      
      if (uniqueValues === 1) {
        questions.push({
          id: `constant-column-${index}`,
          question: `Column "${header}" has the same value in all rows. Should I remove it?`,
          context: {
            column: header,
            value: values[0]
          },
          type: 'confirmation'
        });
      }
    });

    // Check for potential date columns
    headers.forEach((header, index) => {
      const values = sampleRows.map(row => row[index]);
      const isDate = values.every(v => 
        /^\d{4}-\d{2}-\d{2}$/.test(v) ||
        /^\d{2}\/\d{2}\/\d{4}$/.test(v)
      );

      if (isDate) {
        questions.push({
          id: `date-format-${index}`,
          question: `Column "${header}" appears to contain dates. What format should I use?`,
          context: {
            column: header,
            sampleValues: values
          },
          type: 'choice',
          options: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']
        });
      }
    });

    return questions;
  }
}

export const aiService = new AIService({
  enabled: true,
  model: 'grok-3',
  interactiveMode: true,
  confidenceThreshold: 0.8
}); 
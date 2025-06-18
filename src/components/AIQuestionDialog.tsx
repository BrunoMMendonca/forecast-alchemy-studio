import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AIQuestion, AIResponse, aiService } from '@/services/aiService';
import { Sparkles } from 'lucide-react';

interface AIQuestionDialogProps {
  open: boolean;
  onClose: () => void;
  question: AIQuestion;
  onResponse: (response: AIResponse) => void;
}

export const AIQuestionDialog: React.FC<AIQuestionDialogProps> = ({
  open,
  onClose,
  question,
  onResponse,
}) => {
  const [answer, setAnswer] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');

  useEffect(() => {
    if (open) {
      setAnswer('');
      setExplanation('');
    }
  }, [open, question]);

  const handleSubmit = () => {
    onResponse({
      questionId: question.id,
      answer,
      confidence: 1,
      explanation: explanation || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            {question.question}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {question.type === 'confirmation' && (
            <RadioGroup
              value={answer}
              onValueChange={setAnswer}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes">Yes, proceed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no">No, skip this</Label>
              </div>
            </RadioGroup>
          )}

          {question.type === 'choice' && question.options && (
            <RadioGroup
              value={answer}
              onValueChange={setAnswer}
              className="space-y-2"
            >
              {question.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === 'input' && (
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter your answer..."
            />
          )}

          <div className="mt-4">
            <Label htmlFor="explanation">Additional explanation (optional)</Label>
            <Input
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Add any additional context..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!answer}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
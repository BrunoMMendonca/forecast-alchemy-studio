import React, { useState } from 'react';
import { Button } from './src/components/ui/button';
import { Plus } from 'lucide-react';

// Simple debug component to test the holiday button
export const DebugHolidayButton: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleButtonClick = () => {
    console.log('Button clicked!');
    setClickCount(prev => prev + 1);
    setShowForm(!showForm);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Debug Holiday Button</h3>
      
      <div className="space-y-4">
        <div>
          <p>Click count: {clickCount}</p>
          <p>Form visible: {showForm ? 'Yes' : 'No'}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Holiday (Debug)
        </Button>

        {showForm && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-2">Holiday Form</h4>
            <p>This form should appear when the button is clicked.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              className="mt-2"
            >
              Close Form
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}; 
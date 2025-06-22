import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-sm max-w-none text-slate-700">
      <ReactMarkdown
        components={{
          h1: ({node, ...props}) => <h3 className="text-base font-bold text-slate-800 my-2" {...props} />,
          h2: ({node, ...props}) => <h4 className="text-sm font-bold text-slate-800 my-1" {...props} />,
          p: ({node, ...props}) => <p className="mb-2" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-inside" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-inside" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 
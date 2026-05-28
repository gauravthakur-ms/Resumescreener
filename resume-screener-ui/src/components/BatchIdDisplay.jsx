import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function BatchIdDisplay({ batchId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(batchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-2 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2">
      <span className="font-mono text-sm text-white select-all">{batchId}</span>
      <button
        onClick={handleCopy}
        className="text-muted hover:text-coral transition-colors shrink-0"
        title="Copy Batch ID"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

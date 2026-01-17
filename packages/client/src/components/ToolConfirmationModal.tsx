import { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, X, Shield, ShieldCheck } from 'lucide-react';
import type { PendingToolConfirmation, ConfirmationScope } from '../stores/chatStore';

interface ToolConfirmationModalProps {
  confirmation: PendingToolConfirmation;
  onConfirm: (approved: boolean, scope?: ConfirmationScope) => void;
}

export default function ToolConfirmationModal({ confirmation, onConfirm }: ToolConfirmationModalProps) {
  const [showArgs, setShowArgs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (approved: boolean, scope?: ConfirmationScope) => {
    setIsSubmitting(true);
    try {
      onConfirm(approved, scope);
    } catch (error) {
      console.error('Error confirming tool:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2 text-warning">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Tool Permission Required</h3>
              <p className="text-sm text-text-secondary">Allow this tool to run?</p>
            </div>
          </div>
          <button
            onClick={() => handleConfirm(false)}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="Deny"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Tool Info */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-background-secondary">
            <div className="rounded p-1.5 bg-primary/10 text-primary">
              <Wrench size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-primary">{confirmation.toolName}</div>
              <div className="text-sm text-text-muted truncate">
                Server: {confirmation.serverId}
              </div>
            </div>
          </div>

          {/* Arguments (collapsible) */}
          {confirmation.toolArgs != null && typeof confirmation.toolArgs === 'object' && Object.keys(confirmation.toolArgs as object).length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setShowArgs(!showArgs)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary transition-colors"
              >
                <span>View arguments</span>
                {showArgs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {showArgs && (
                <div className="px-3 py-2 border-t border-border bg-background-secondary/50">
                  <pre className="text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                    {JSON.stringify(confirmation.toolArgs, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Trust info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <ShieldCheck size={16} className="mt-0.5 text-primary flex-shrink-0" />
            <p className="text-sm text-text-secondary">
              You can allow this tool to run once, for this conversation, or always for future chats.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border bg-background-secondary/30">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => handleConfirm(true, 'once')}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              Allow once
            </button>
            <button
              onClick={() => handleConfirm(true, 'thread')}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg border border-border bg-background text-text-primary font-medium hover:bg-background-secondary transition-colors disabled:opacity-50"
            >
              Allow for this chat
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleConfirm(true, 'always')}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg border border-success/50 bg-success/5 text-success font-medium hover:bg-success/10 transition-colors disabled:opacity-50"
            >
              Always allow
            </button>
            <button
              onClick={() => handleConfirm(false)}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg border border-error/50 bg-error/5 text-error font-medium hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

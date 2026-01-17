import { ChevronDown, Bot } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useChatStore, type AgentInfo } from '../stores/chatStore';

interface AgentSelectorProps {
  className?: string;
}

export default function AgentSelector({ className = '' }: AgentSelectorProps) {
  const { availableAgents, selectedAgentId, setSelectedAgentId, isLoadingAgents } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show if only one agent or no agents
  if (availableAgents.length <= 1) {
    return null;
  }

  const selectedAgent = availableAgents.find((a) => a.id === selectedAgentId) || availableAgents[0];

  function handleSelect(agent: AgentInfo) {
    setSelectedAgentId(agent.id);
    setIsOpen(false);
  }

  if (isLoadingAgents) {
    return (
      <div className={`flex items-center gap-2 text-sm text-text-muted ${className}`}>
        <Bot size={16} />
        <span>Loading agents...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-primary hover:border-primary hover:bg-background-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <Bot size={16} className="text-text-secondary" />
        <span className="max-w-[150px] truncate">{selectedAgent?.name || 'Select agent'}</span>
        <ChevronDown
          size={16}
          className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-background shadow-lg">
          <div className="max-h-[300px] overflow-y-auto py-1">
            {availableAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleSelect(agent)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background-secondary ${
                  agent.id === selectedAgentId
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-primary'
                }`}
              >
                <Bot size={16} className={agent.id === selectedAgentId ? 'text-primary' : 'text-text-secondary'} />
                <span className="flex-1">{agent.name}</span>
                {agent.isDefault && (
                  <span className="rounded bg-background-secondary px-1.5 py-0.5 text-xs text-text-muted">
                    Default
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

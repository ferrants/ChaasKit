import { useState, useRef, useEffect } from 'react';
import { useTeam } from '../contexts/TeamContext';
import { useChatStore } from '../stores/chatStore';

export function TeamSwitcher() {
  const { teams, currentTeamId, setCurrentTeamId, isLoadingTeams, createTeam } = useTeam();
  const { loadThreads, clearCurrentThread } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTeam = currentTeamId
    ? teams.find((t) => t.id === currentTeamId)
    : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (teamId: string | null) => {
    setCurrentTeamId(teamId);
    setIsOpen(false);
    clearCurrentThread();
    // Reload threads for the new context
    setTimeout(() => loadThreads(), 100);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const team = await createTeam(newTeamName.trim());
      setNewTeamName('');
      setIsCreating(false);
      handleSelect(team.id);
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  if (isLoadingTeams) {
    return (
      <div className="px-3 py-2 text-sm text-text-muted">
        Loading teams...
      </div>
    );
  }

  // Show minimal version if user has no teams
  if (teams.length === 0 && !isCreating) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border text-text-muted hover:border-text-secondary hover:text-text-secondary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create a Team
        </button>

        {isCreating && (
          <form
            onSubmit={handleCreateTeam}
            className="absolute z-50 w-full mt-1 p-3 rounded-md shadow-lg bg-background border border-border"
          >
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm rounded border border-input-border bg-input-background text-text-primary focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-sm rounded bg-primary text-white hover:opacity-90"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTeamName('');
                }}
                className="px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:bg-background-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md bg-background-secondary hover:bg-border transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {currentTeam ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            )}
          </svg>
          <span className="truncate">
            {currentTeam ? currentTeam.name : 'Personal'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-md shadow-lg bg-background border border-border">
          <button
            onClick={() => handleSelect(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background-secondary ${
              !currentTeamId ? 'text-primary' : 'text-text-primary'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Personal
            {!currentTeamId && (
              <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {teams.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-xs font-medium text-text-muted uppercase">
                Teams
              </div>
            </>
          )}

          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSelect(team.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background-secondary ${
                currentTeamId === team.id ? 'text-primary' : 'text-text-primary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="truncate flex-1 text-left">{team.name}</span>
              <span className="text-xs text-text-muted">
                {team.memberCount}
              </span>
              {currentTeamId === team.id && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}

          {/* Create Team */}
          <div className="border-t border-border mt-1 pt-1">
            {isCreating ? (
              <form onSubmit={handleCreateTeam} className="p-2">
                <input
                  type="text"
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm rounded border border-input-border bg-input-background text-text-primary focus:outline-none focus:border-primary"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-1 text-xs rounded bg-primary text-white hover:opacity-90"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setNewTeamName('');
                    }}
                    className="px-3 py-1 text-xs rounded border border-border text-text-secondary hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:bg-background-secondary hover:text-text-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Team
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

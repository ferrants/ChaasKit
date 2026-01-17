import { useState, useCallback, type ReactNode } from 'react';
import { Menu, Search } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import Sidebar from '../components/Sidebar';
import SearchModal from '../components/SearchModal';
import { useConfig } from '../contexts/ConfigContext';
import { useChatStore } from '../stores/chatStore';
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts';
import { useAppPath } from '../hooks/useAppPath';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { threadId } = useParams();
  const navigate = useNavigate();
  const appPath = useAppPath();
  const config = useConfig();
  const { currentThread, clearCurrentThread } = useChatStore();

  // Get display title for mobile header
  const headerTitle = currentThread?.title || config.app.name;

  // Keyboard shortcuts
  const handleNewThread = useCallback(() => {
    // Clear current thread and navigate to welcome screen
    // Thread will be created when user sends first message with selected agent
    clearCurrentThread();
    navigate(appPath('/'));
    setSidebarOpen(false);
  }, [clearCurrentThread, navigate, appPath]);

  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onNewThread: handleNewThread,
    onEscape: () => {
      if (searchOpen) setSearchOpen(false);
      else if (sidebarOpen) setSidebarOpen(false);
    },
  });

  return (
    <div className="flex h-screen-safe bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform bg-sidebar transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} onOpenSearch={() => setSearchOpen(true)} />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header - sticky at top */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0 rounded-lg p-2 text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="flex-1 truncate text-base font-medium text-text-primary">
            {headerTitle}
          </h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex-shrink-0 rounded-lg p-2 text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

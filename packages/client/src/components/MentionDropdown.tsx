import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FileText, Users, Folder, Loader2 } from 'lucide-react';
import type { MentionableDocument, DocumentScope } from '@chaaskit/shared';

interface MentionDropdownProps {
  documents: MentionableDocument[];
  grouped?: {
    my: MentionableDocument[];
    team: MentionableDocument[];
    project: MentionableDocument[];
  };
  isLoading?: boolean;
  selectedIndex: number;
  onSelect: (doc: MentionableDocument) => void;
  position: { top: number; left: number };
}

export interface MentionDropdownHandle {
  scrollToSelected: () => void;
}

function getScopeIcon(scope: DocumentScope) {
  switch (scope) {
    case 'my':
      return <FileText size={14} className="text-text-muted" />;
    case 'team':
      return <Users size={14} className="text-text-muted" />;
    case 'project':
      return <Folder size={14} className="text-text-muted" />;
  }
}

function getScopeLabel(scope: DocumentScope) {
  switch (scope) {
    case 'my':
      return 'My Documents';
    case 'team':
      return 'Team';
    case 'project':
      return 'Project';
  }
}

function formatCharCount(count: number): string {
  if (count < 1000) return `${count} chars`;
  return `${(count / 1000).toFixed(1)}k chars`;
}

const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(
  function MentionDropdown(
    { documents, grouped, isLoading, selectedIndex, onSelect, position },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    useImperativeHandle(ref, () => ({
      scrollToSelected: () => {
        const selectedItem = itemRefs.current.get(selectedIndex);
        if (selectedItem) {
          selectedItem.scrollIntoView({ block: 'nearest' });
        }
      },
    }));

    useEffect(() => {
      const selectedItem = itemRefs.current.get(selectedIndex);
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    // Render grouped or flat list
    const renderDocuments = () => {
      if (grouped && (grouped.my.length > 0 || grouped.team.length > 0 || grouped.project.length > 0)) {
        let flatIndex = 0;
        const sections: JSX.Element[] = [];

        const renderSection = (scope: DocumentScope, docs: MentionableDocument[]) => {
          if (docs.length === 0) return null;

          const sectionItems = docs.map((doc) => {
            const index = flatIndex++;
            return (
              <button
                key={doc.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(index, el);
                  else itemRefs.current.delete(index);
                }}
                onClick={() => onSelect(doc)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background-secondary ${
                  selectedIndex === index ? 'bg-background-secondary' : ''
                }`}
              >
                {getScopeIcon(doc.scope)}
                <span className="flex-1 truncate text-text-primary">{doc.name}</span>
                <span className="text-xs text-text-muted">{formatCharCount(doc.charCount)}</span>
              </button>
            );
          });

          return (
            <div key={scope}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted">
                {getScopeIcon(scope)}
                {getScopeLabel(scope)}
                {scope !== 'my' && docs[0]?.scopeName && (
                  <span className="text-text-secondary">: {docs[0].scopeName}</span>
                )}
              </div>
              {sectionItems}
            </div>
          );
        };

        if (grouped.my.length > 0) {
          sections.push(renderSection('my', grouped.my)!);
        }
        if (grouped.team.length > 0) {
          sections.push(renderSection('team', grouped.team)!);
        }
        if (grouped.project.length > 0) {
          sections.push(renderSection('project', grouped.project)!);
        }

        return sections;
      }

      // Flat list fallback
      return documents.map((doc, index) => (
        <button
          key={doc.id}
          ref={(el) => {
            if (el) itemRefs.current.set(index, el);
            else itemRefs.current.delete(index);
          }}
          onClick={() => onSelect(doc)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background-secondary ${
            selectedIndex === index ? 'bg-background-secondary' : ''
          }`}
        >
          {getScopeIcon(doc.scope)}
          <span className="flex-1 truncate text-text-primary">{doc.name}</span>
          <span className="text-xs text-text-muted">{formatCharCount(doc.charCount)}</span>
        </button>
      ));
    };

    return (
      <div
        ref={containerRef}
        className="fixed z-50 max-h-64 min-w-[240px] max-w-[320px] overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : documents.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-text-muted">
            No documents found
          </div>
        ) : (
          renderDocuments()
        )}
      </div>
    );
  }
);

export default MentionDropdown;

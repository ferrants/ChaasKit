import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { MentionableDocument } from '@chaaskit/shared';
import { useMentionSearch } from '../hooks/useMentionSearch';
import MentionDropdown, { type MentionDropdownHandle } from './MentionDropdown';
import { useConfig } from '../contexts/ConfigContext';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  maxHeight?: number;
  autoGrow?: boolean;
}

export interface MentionInputHandle {
  focus: () => void;
  blur: () => void;
}

const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(function MentionInput(
  {
    value,
    onChange,
    onKeyDown,
    placeholder,
    disabled,
    className = '',
    rows = 1,
    maxHeight = 200,
    autoGrow = true,
  },
  ref
) {
  const config = useConfig();
  const documentsEnabled = config.documents?.enabled ?? false;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<MentionDropdownHandle>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { search, clearResults, results, isSearching } = useMentionSearch();

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
  }));

  // Auto-grow textarea
  const adjustHeight = useCallback(() => {
    if (!autoGrow || !textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [autoGrow, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Calculate dropdown position based on cursor
  const updateDropdownPosition = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();

    // Create a temporary span to measure text position
    const span = document.createElement('span');
    span.style.font = getComputedStyle(textarea).font;
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre-wrap';
    span.style.wordWrap = 'break-word';
    span.style.width = `${textarea.clientWidth}px`;

    // Get text up to cursor
    const textBeforeCursor = value.substring(0, textarea.selectionStart);
    span.textContent = textBeforeCursor;
    document.body.appendChild(span);

    // Calculate approximate position
    const lines = textBeforeCursor.split('\n');
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const currentLineIndex = lines.length - 1;

    document.body.removeChild(span);

    // Position dropdown below the current line
    const top = rect.top + (currentLineIndex + 1) * lineHeight + 4;
    const left = rect.left;

    // Ensure dropdown doesn't go off-screen
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 256; // max-h-64 = 16rem = 256px
    const adjustedTop = top + dropdownHeight > viewportHeight ? rect.top - dropdownHeight - 4 : top;

    setDropdownPosition({
      top: adjustedTop,
      left: Math.max(8, Math.min(left, window.innerWidth - 328)), // 320px width + 8px margin
    });
  }, [value]);

  // Parse for @ mentions as user types
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;

      onChange(newValue);

      if (!documentsEnabled) return;

      // Find the @ that might be starting a mention
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\S*)$/);

      if (atMatch) {
        const query = atMatch[1];
        const startIndex = textBeforeCursor.length - atMatch[0].length;

        setMentionStartIndex(startIndex);
        setMentionQuery(query);
        setSelectedIndex(0);
        setShowDropdown(true);
        updateDropdownPosition();

        // Search with the query (after the @)
        search(query || '');
      } else {
        // No @ mention in progress
        if (showDropdown) {
          setShowDropdown(false);
          clearResults();
        }
      }
    },
    [onChange, documentsEnabled, showDropdown, search, clearResults, updateDropdownPosition]
  );

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showDropdown && results?.documents.length) {
        const docCount = results.documents.length;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % docCount);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + docCount) % docCount);
          return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selectedDoc = results.documents[selectedIndex];
          if (selectedDoc) {
            insertMention(selectedDoc);
          }
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setShowDropdown(false);
          clearResults();
          return;
        }
      }

      // Pass through to parent handler
      onKeyDown?.(e);
    },
    [showDropdown, results, selectedIndex, onKeyDown, clearResults]
  );

  // Insert the selected mention
  const insertMention = useCallback(
    (doc: MentionableDocument) => {
      if (mentionStartIndex < 0) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const beforeMention = value.substring(0, mentionStartIndex);
      const afterMention = value.substring(cursorPos);

      // Insert the full path
      const mentionText = doc.path;
      const newValue = beforeMention + mentionText + ' ' + afterMention;

      onChange(newValue);

      // Move cursor after the inserted mention
      const newCursorPos = mentionStartIndex + mentionText.length + 1;
      setTimeout(() => {
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
      }, 0);

      setShowDropdown(false);
      clearResults();
    },
    [value, mentionStartIndex, onChange, clearResults]
  );

  // Handle document selection from dropdown
  const handleSelectDocument = useCallback(
    (doc: MentionableDocument) => {
      insertMention(doc);
    },
    [insertMention]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showDropdown &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        clearResults();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, clearResults]);

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={className}
        style={{
          height: 'auto',
          minHeight: `${rows * 22 + 22}px`,
        }}
        onInput={adjustHeight}
      />

      {showDropdown &&
        createPortal(
          <MentionDropdown
            ref={dropdownRef}
            documents={results?.documents ?? []}
            grouped={results?.grouped}
            isLoading={isSearching}
            selectedIndex={selectedIndex}
            onSelect={handleSelectDocument}
            position={dropdownPosition}
          />,
          document.body
        )}
    </>
  );
});

export default MentionInput;

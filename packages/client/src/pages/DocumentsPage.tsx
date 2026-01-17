import { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router';
import {
  FileText,
  Plus,
  Trash2,
  X,
  Loader2,
  Upload,
  Search,
  Users,
  Folder,
  Edit2,
  Eye,
} from 'lucide-react';
import type { MentionableDocument, DocumentScope } from '@chaaskit/shared';
import { useConfig, useConfigLoaded } from '../contexts/ConfigContext';
import { useTeam } from '../contexts/TeamContext';
import { useProject } from '../contexts/ProjectContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';

interface DocumentWithContent extends MentionableDocument {
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentsPage() {
  const config = useConfig();
  const configLoaded = useConfigLoaded();
  const { teams, currentTeamId } = useTeam();
  const { projects, currentProjectId } = useProject();
  const appPath = useAppPath();

  const [documents, setDocuments] = useState<DocumentWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<DocumentScope | 'all'>('all');

  // Create/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentWithContent | null>(null);
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docScope, setDocScope] = useState<DocumentScope>('my');
  const [docTeamId, setDocTeamId] = useState('');
  const [docProjectId, setDocProjectId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // View modal
  const [viewingDoc, setViewingDoc] = useState<DocumentWithContent | null>(null);
  const [viewContent, setViewContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const documentsEnabled = config.documents?.enabled ?? false;
  const teamsEnabled = config.teams?.enabled ?? false;
  const projectsEnabled = config.projects?.enabled ?? false;

  useEffect(() => {
    if (documentsEnabled) {
      loadDocuments();
    } else {
      setIsLoading(false);
    }
  }, [documentsEnabled, scopeFilter, currentTeamId, currentProjectId]);

  async function loadDocuments() {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (scopeFilter !== 'all') params.set('scope', scopeFilter);
      if (searchQuery) params.set('query', searchQuery);
      if (currentTeamId) params.set('teamId', currentTeamId);
      if (currentProjectId) params.set('projectId', currentProjectId);

      const res = await api.get<{ documents: DocumentWithContent[] }>(
        `/api/documents?${params.toString()}`
      );
      setDocuments(res.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadDocuments();
  }

  function openCreateModal() {
    setEditingDoc(null);
    setDocName('');
    setDocContent('');
    setDocScope('my');
    setDocTeamId('');
    setDocProjectId('');
    setShowModal(true);
  }

  function openEditModal(doc: DocumentWithContent) {
    setEditingDoc(doc);
    setDocName(doc.name);
    setDocContent(doc.content || '');
    setDocScope(doc.scope);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (editingDoc) {
        // Update existing
        await api.patch(`/api/documents/${editingDoc.id}`, {
          name: docName,
          content: docContent,
        });
      } else {
        // Create new
        await api.post('/api/documents', {
          name: docName,
          content: docContent,
          mimeType: 'text/plain',
          teamId: docScope === 'team' ? docTeamId : undefined,
          projectId: docScope === 'project' ? docProjectId : undefined,
        });
      }

      setShowModal(false);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (currentTeamId) formData.append('teamId', currentTeamId);
      if (currentProjectId) formData.append('projectId', currentProjectId);

      await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Upload failed');
        }
        return res.json();
      });

      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingId(id);
    setError('');

    try {
      await api.delete(`/api/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleView(doc: DocumentWithContent) {
    setViewingDoc(doc);
    setIsLoadingContent(true);

    try {
      const res = await api.get<{ content: string; totalChars: number }>(
        `/api/documents/${doc.id}/content`
      );
      setViewContent(res.content);
    } catch (err) {
      setViewContent('Failed to load content');
    } finally {
      setIsLoadingContent(false);
    }
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

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatCharCount(count: number): string {
    if (count < 1000) return `${count} chars`;
    return `${(count / 1000).toFixed(1)}k chars`;
  }

  // Wait for config to load before checking if documents is enabled
  if (!configLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!documentsEnabled) {
    return <Navigate to={appPath('/')} replace />;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Documents</h1>
          </div>
          <Link
            to={appPath('/')}
            className="flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-background-secondary"
            aria-label="Close"
          >
            <X size={20} />
          </Link>
        </div>

        {/* Description */}
        <div className="mb-6 text-sm text-text-secondary">
          Manage your documents that can be referenced in chat using @mentions.
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-error/10 p-4 text-sm text-error">{error}</div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={16} />
            New Document
          </button>

          <label className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-background-secondary cursor-pointer">
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Upload File
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.json"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
        </div>

        {/* Search & Filter */}
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-input-border bg-input-background pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as DocumentScope | 'all')}
            className="rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="all">All Scopes</option>
            <option value="my">My Documents</option>
            {teamsEnabled && <option value="team">Team</option>}
            {projectsEnabled && <option value="project">Project</option>}
          </select>

          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-background-secondary"
          >
            Search
          </button>
        </form>

        {/* Documents List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-border bg-background-secondary p-8 text-center">
            <FileText size={48} className="mx-auto mb-4 text-text-muted" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No Documents</h3>
            <p className="text-sm text-text-secondary mb-4">
              Create a document or upload a file to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-border bg-background-secondary p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getScopeIcon(doc.scope)}
                      <span className="font-medium text-text-primary truncate">{doc.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background text-text-muted">
                        {doc.mimeType.split('/')[1]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span className="font-mono">{doc.path}</span>
                      <span>{formatCharCount(doc.charCount)}</span>
                      <span>Updated: {formatDate(doc.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleView(doc)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      onClick={() => openEditModal(doc)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-error hover:bg-error/10 disabled:opacity-50"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                {editingDoc ? 'Edit Document' : 'Create Document'}
              </h2>
              <form onSubmit={handleSave}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="e.g., api-guidelines"
                      required
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Use lowercase with hyphens. This will be part of the @mention path.
                    </p>
                  </div>

                  {!editingDoc && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Scope
                      </label>
                      <select
                        value={docScope}
                        onChange={(e) => setDocScope(e.target.value as DocumentScope)}
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="my">Personal (@my/...)</option>
                        {teamsEnabled && teams.length > 0 && (
                          <option value="team">Team (@team/...)</option>
                        )}
                        {projectsEnabled && projects.length > 0 && (
                          <option value="project">Project (@project/...)</option>
                        )}
                      </select>
                    </div>
                  )}

                  {!editingDoc && docScope === 'team' && teamsEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Team
                      </label>
                      <select
                        value={docTeamId}
                        onChange={(e) => setDocTeamId(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="">Select a team</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!editingDoc && docScope === 'project' && projectsEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Project
                      </label>
                      <select
                        value={docProjectId}
                        onChange={(e) => setDocProjectId(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="">Select a project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Content
                    </label>
                    <textarea
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      placeholder="Enter document content..."
                      rows={12}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      {docContent.length} characters
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !docName.trim()}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isSaving && <Loader2 size={14} className="animate-spin" />}
                    {editingDoc ? 'Save Changes' : 'Create Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Modal */}
        {viewingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setViewingDoc(null)}
            />
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{viewingDoc.name}</h2>
                  <p className="text-sm text-text-muted font-mono">{viewingDoc.path}</p>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 text-text-muted hover:text-text-primary"
                >
                  <X size={20} />
                </button>
              </div>

              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <pre className="rounded-lg bg-background-secondary p-4 text-sm text-text-primary font-mono whitespace-pre-wrap overflow-x-auto">
                  {viewContent}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

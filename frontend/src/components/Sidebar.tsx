import { useEffect, useState } from 'react';
import { Trash2, BookOpen, LogOut, Plus, Pencil, Check, X as XIcon, Moon, Sun, X } from 'lucide-react';
import { getSessions, getDocuments, getMessages, deleteDocument, deleteSession, renameSession, logout } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useToastStore } from '../store/useToastStore';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const { sessions, currentSessionId, documents, setSessions, setCurrentSessionId, setDocuments, setMessages, removeDocument, removeSession, updateSessionName, startNewChat } = useAppStore();
  const { email, clearAuth } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const addToast = useToastStore((s) => s.addToast);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'session' | 'document'; id: string; name: string } | null>(null);

  const handleLogout = () => {
    logout();
    clearAuth();
  };

  useEffect(() => {
    getSessions().then(setSessions).catch(() => addToast('Failed to load sessions', 'error'));
  }, [setSessions, addToast]);

  const selectSession = async (id: string) => {
    setCurrentSessionId(id);
    onClose?.();
    try {
      const [docs, apiMessages] = await Promise.all([getDocuments(id), getMessages(id)]);
      setDocuments(docs);
      setMessages(
        apiMessages.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          citations: m.citations ?? undefined,
          lowConfidence: m.low_confidence,
        })),
      );
    } catch {
      addToast('Failed to load session', 'error');
    }
  };

  const handleDeleteDoc = async () => {
    if (!confirmDelete || confirmDelete.type !== 'document') return;
    try {
      await deleteDocument(confirmDelete.id);
      removeDocument(confirmDelete.id);
      addToast('Document deleted', 'success');
    } catch {
      addToast('Failed to delete document', 'error');
    }
    setConfirmDelete(null);
  };

  const handleDeleteSession = async () => {
    if (!confirmDelete || confirmDelete.type !== 'session') return;
    try {
      await deleteSession(confirmDelete.id);
      removeSession(confirmDelete.id);
      addToast('Session deleted', 'success');
    } catch {
      addToast('Failed to delete session', 'error');
    }
    setConfirmDelete(null);
  };

  const startEditing = (e: React.MouseEvent, sessionId: string, currentName: string) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditName(currentName);
  };

  const confirmRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editName.trim()) return;
    try {
      await renameSession(editingId, editName.trim());
      updateSessionName(editingId, editName.trim());
    } catch {
      addToast('Failed to rename session', 'error');
    }
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      <div className="w-64 bg-kraft dark:bg-chalk-bg border-r border-ruled dark:border-chalk-muted flex flex-col h-full binder-rings">
        {/* Header */}
        <div className="p-4 border-b border-ruled dark:border-chalk-muted flex items-center justify-between">
          <h1 className="font-hand text-xl text-pencil dark:text-chalk-text flex items-center gap-2">
            <BookOpen size={20} /> Study Assistant
          </h1>
          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="lg:hidden text-charcoal-light dark:text-chalk-muted"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat */}
        <div className="p-3 pb-0">
          <button
            onClick={() => { startNewChat(); onClose?.(); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-ruled text-sm text-pencil hover:bg-cream dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg-light transition-colors"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-medium text-charcoal-light dark:text-chalk-muted uppercase tracking-wider mb-2 font-hand">Sessions</p>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => editingId !== s.id && selectSession(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 cursor-pointer flex items-center justify-between group transition-colors ${
                  s.id === currentSessionId
                    ? 'bg-pencil/10 text-pencil border-l-2 border-pencil dark:bg-chalk-bg-light dark:text-chalk-text'
                    : 'hover:bg-cream text-charcoal dark:text-chalk-text dark:hover:bg-chalk-bg-light'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-pencil rounded bg-white focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:text-chalk-text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(e as unknown as React.MouseEvent);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <button onClick={confirmRename} className="text-green-600 shrink-0" aria-label="Confirm rename">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEditing} className="text-charcoal-light shrink-0" aria-label="Cancel rename">
                        <XIcon size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="truncate">{s.name}</div>
                      <span className="block text-xs text-charcoal-light dark:text-chalk-muted">{s.doc_count} doc(s)</span>
                    </>
                  )}
                </div>
                {editingId !== s.id && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={(e) => startEditing(e, s.id, s.name)}
                      className="text-charcoal-light opacity-0 group-hover:opacity-100 dark:text-chalk-muted"
                      aria-label={`Rename session ${s.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'session', id: s.id, name: s.name }); }}
                      className="text-red-400 opacity-0 group-hover:opacity-100"
                      aria-label={`Delete session ${s.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents */}
          {currentSessionId && documents.length > 0 && (
            <div className="p-3 border-t border-ruled dark:border-chalk-muted">
              <p className="text-xs font-medium text-charcoal-light dark:text-chalk-muted uppercase tracking-wider mb-2 font-hand">Documents</p>
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-cream dark:hover:bg-chalk-bg-light group">
                  <div className="text-xs text-charcoal dark:text-chalk-text truncate flex-1">{d.name}</div>
                  <button
                    onClick={() => setConfirmDelete({ type: 'document', id: d.id, name: d.name })}
                    className="text-red-400 opacity-0 group-hover:opacity-100 ml-2"
                    aria-label={`Delete document ${d.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: theme toggle + user + logout */}
        <div className="border-t border-ruled dark:border-chalk-muted p-3 flex items-center justify-between">
          <button
            onClick={toggleTheme}
            className="text-charcoal-light dark:text-chalk-muted hover:text-pencil dark:hover:text-chalk-text"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className="text-xs text-charcoal-light dark:text-chalk-muted truncate mx-2">{email}</span>
          <button onClick={handleLogout} className="text-charcoal-light dark:text-chalk-muted hover:text-red-500" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type}?`}
          message={`"${confirmDelete.name}" will be permanently deleted. This can't be undone.`}
          onConfirm={confirmDelete.type === 'session' ? handleDeleteSession : handleDeleteDoc}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

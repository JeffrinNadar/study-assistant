import { useEffect, useState } from 'react';
import { Trash2, BookOpen, LogOut, Plus, Pencil, Check, X } from 'lucide-react';
import { getSessions, getDocuments, getMessages, deleteDocument, deleteSession, renameSession, logout } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

export function Sidebar({ onClose: _onClose }: { onClose?: () => void }) {
  const { sessions, currentSessionId, documents, setSessions, setCurrentSessionId, setDocuments, setMessages, removeDocument, removeSession, updateSessionName, startNewChat } = useAppStore();
  const { email, clearAuth } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleLogout = () => {
    logout();
    clearAuth();
  };

  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, [setSessions]);

  const selectSession = async (id: string) => {
    setCurrentSessionId(id);
    const [docs, apiMessages] = await Promise.all([
      getDocuments(id),
      getMessages(id),
    ]);
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
  };

  const handleDeleteDoc = async (docId: string) => {
    await deleteDocument(docId);
    removeDocument(docId);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSession(sessionId);
    removeSession(sessionId);
  };

  const startEditing = (e: React.MouseEvent, sessionId: string, currentName: string) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditName(currentName);
  };

  const confirmRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editName.trim()) return;
    await renameSession(editingId, editName.trim());
    updateSessionName(editingId, editName.trim());
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen size={18} /> Study Assistant
        </h1>
      </div>

      {/* New Chat button */}
      <div className="p-3 pb-0">
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sessions</p>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => editingId !== s.id && selectSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 cursor-pointer flex items-center justify-between group ${
                s.id === currentSessionId ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(e as unknown as React.MouseEvent);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                    <button onClick={confirmRename} className="text-green-600 shrink-0">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEditing} className="text-gray-400 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="truncate">{s.name}</div>
                    <span className="block text-xs text-gray-400">{s.doc_count} doc(s)</span>
                  </>
                )}
              </div>
              {editingId !== s.id && (
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    onClick={(e) => startEditing(e, s.id, s.name)}
                    className="text-gray-400 opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Documents in current session */}
        {currentSessionId && documents.length > 0 && (
          <div className="p-3 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Documents</p>
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-100 group">
                <div className="text-xs text-gray-700 truncate flex-1">{d.name}</div>
                <button
                  onClick={() => handleDeleteDoc(d.id)}
                  className="text-red-400 opacity-0 group-hover:opacity-100 ml-2"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User / Logout */}
      <div className="border-t border-gray-200 p-3 flex items-center justify-between">
        <span className="text-xs text-gray-500 truncate">{email}</span>
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-500" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

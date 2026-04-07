import { useEffect } from 'react';
import { Trash2, BookOpen, LogOut } from 'lucide-react';
import { getSessions, getDocuments, deleteDocument, deleteSession, logout } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

export function Sidebar() {
  const { sessions, currentSessionId, documents, setSessions, setCurrentSessionId, setDocuments, removeDocument, removeSession } = useAppStore();
  const { email, clearAuth } = useAuthStore();

  const handleLogout = () => {
    logout();
    clearAuth();
  };

  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, [setSessions]);

  const selectSession = async (id: string) => {
    setCurrentSessionId(id);
    const docs = await getDocuments(id);
    setDocuments(docs);
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

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen size={18} /> Study Assistant
        </h1>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sessions</p>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 cursor-pointer flex items-center justify-between group ${
                s.id === currentSessionId ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{s.name}</div>
                <span className="block text-xs text-gray-400">{s.doc_count} doc(s)</span>
              </div>
              <button
                onClick={(e) => handleDeleteSession(e, s.id)}
                className="text-red-400 opacity-0 group-hover:opacity-100 ml-2 shrink-0"
              >
                <Trash2 size={14} />
              </button>
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

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { AuthPage } from './components/AuthPage';
import { ToastContainer } from './components/Toast';
import { useAuthStore } from './store/useAuthStore';
import './store/useThemeStore'; // side-effect: applies dark class on load

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-paper">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-kraft border border-ruled shadow-md text-charcoal dark:bg-chalk-bg dark:text-chalk-text dark:border-chalk-muted"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar overlay (mobile/tablet) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-50 h-full transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Margin line */}
      <div className="hidden lg:block w-[3px] bg-margin shrink-0" />

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-ruled">
        <ChatPanel />
      </main>

      <ToastContainer />
    </div>
  );
}

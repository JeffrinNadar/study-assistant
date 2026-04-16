import { useState, useEffect } from 'react';
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

  // Close mobile sidebar on Escape key
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

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
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:bg-pencil focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to main content
      </a>

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
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed lg:static z-50 h-full transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Session navigation"
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </nav>

      {/* Margin line */}
      <div className="hidden lg:block w-[3px] bg-margin shrink-0" aria-hidden="true" />

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-hidden bg-ruled">
        <ChatPanel />
      </main>

      <ToastContainer />
    </div>
  );
}

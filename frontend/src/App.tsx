import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';

export default function App() {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ChatPanel />
      </main>
    </div>
  );
}

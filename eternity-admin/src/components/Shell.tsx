import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}

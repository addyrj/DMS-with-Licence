// src/app/(superadmin)/layout.js
import Sidebar from '../../components/layout/Sidebar';
import Header  from '../../components/layout/Header';
export default function SALayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <Header />
      <main className="page-main">{children}</main>
    </div>
  );
}

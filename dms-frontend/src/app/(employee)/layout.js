// src/app/(employee)/layout.js
import Sidebar from '../../components/layout/Sidebar';
import Header  from '../../components/layout/Header';
export default function EmployeeLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <Header />
      <main className="page-main">{children}</main>
    </div>
  );
}

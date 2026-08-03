import { Sidebar } from './Sidebar.jsx';

/**
 * Root application layout.
 * Sidebar fixed on left, main scrollable content area on right.
 */
export const AppLayout = ({ children }) => (
  <div className="flex h-screen bg-white">
    <Sidebar />
    <main
      className="flex-1 ml-56 h-screen overflow-y-auto"
      id="main-content"
    >
      {children}
    </main>
  </div>
);

/**
 * Page header section with title, description, and optional right-side actions.
 */
export const PageHeader = ({ title, description, actions }) => (
  <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-gray-200">
    <div>
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 ml-8 shrink-0">{actions}</div>}
  </div>
);

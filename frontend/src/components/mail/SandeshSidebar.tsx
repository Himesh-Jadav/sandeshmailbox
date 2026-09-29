import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '../../lib/api';

interface SandeshSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCompose: () => void;
  user?: User;
  unreadCount?: number;
  starredCount?: number;
  pinnedCount?: number;
  sentCount?: number;
  draftsCount?: number;
  archiveCount?: number;
  trashCount?: number;
  spamCount?: number;
  onLogout?: () => void;
  onViewProfile?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
  isDanger?: boolean;
  isWarning?: boolean;
}

export const SandeshSidebar: React.FC<SandeshSidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  user: _user,
  unreadCount = 0,
  starredCount,
  pinnedCount = 0,
  sentCount = 0,
  draftsCount = 0,
  archiveCount = 0,
  trashCount = 0,
  spamCount = 0,
  onLogout: _onLogout,
  onViewProfile: _onViewProfile,
  isMobileDrawer = false,
  onCloseMobileDrawer,
  searchQuery: _searchQuery,
  onSearchChange: _onSearchChange,
}) => {
  const handleTabSelect = (tabId: string) => {
    onTabChange(tabId);
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  // Primary Operations Nav: Inbox, Pinned
  const primaryNav: NavItem[] = [
    {
      id: 'inbox',
      label: 'Inbox',
      badge: unreadCount > 0 ? unreadCount : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
    },
    {
      id: 'starred',
      label: 'Starred',
      badge: (starredCount ?? pinnedCount) > 0 ? (starredCount ?? pinnedCount) : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
  ];

  // Secondary Folders Nav: Sent, Drafts, Archive, Spam, Trash
  const foldersNav: NavItem[] = [
    {
      id: 'sent',
      label: 'Sent',
      badge: sentCount > 0 ? sentCount : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
    },
    {
      id: 'drafts',
      label: 'Drafts',
      badge: draftsCount > 0 ? draftsCount : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'archive',
      label: 'Archive',
      badge: archiveCount > 0 ? archiveCount : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      id: 'spam',
      label: 'Spam',
      badge: spamCount > 0 ? spamCount : null,
      isWarning: true,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: 'trash',
      label: 'Trash',
      isDanger: true,
      badge: trashCount > 0 ? trashCount : null,
      icon: (
        <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
    },
  ];

  // Render nav item (Mobile Drawer vs Desktop Hover-Expand)
  const renderNavItem = (item: NavItem) => {
    const isActive = activeTab === item.id || (item.id === 'starred' && activeTab === 'pinned') || (item.id === 'pinned' && activeTab === 'starred');
    const isDanger = item.isDanger;
    const isWarning = item.isWarning;

    let activeClasses = 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-xs ring-1 ring-blue-200/60 dark:ring-blue-800/40';
    let inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100';

    if (isDanger) {
      activeClasses = 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 font-semibold shadow-xs';
      inactiveClasses = 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700';
    } else if (isWarning) {
      activeClasses = 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 font-semibold shadow-xs';
      inactiveClasses = 'text-amber-700 dark:text-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 hover:text-amber-800';
    }

    // ── Mobile Drawer Item ──
    if (isMobileDrawer) {
      return (
        <button
          key={item.id}
          onClick={() => handleTabSelect(item.id)}
          title={item.label}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 cursor-pointer relative group/item ${
            isActive ? activeClasses : inactiveClasses
          }`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${
              isDanger
                ? (isActive ? 'text-rose-700 dark:text-rose-300' : 'text-rose-500 dark:text-rose-400')
                : isWarning
                ? (isActive ? 'text-amber-800 dark:text-amber-300' : 'text-amber-600 dark:text-amber-400')
                : (isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400')
            }`}>
              {item.icon}
            </span>
            <span className="font-medium tracking-tight truncate">{item.label}</span>
          </div>

          {item.badge != null && item.badge > 0 && (
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center leading-tight shadow-xs ${
              item.id === 'inbox'
                ? 'bg-blue-600 text-white'
                : item.id === 'spam'
                ? 'bg-amber-200/90 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
            }`}>
              {item.badge}
            </span>
          )}
        </button>
      );
    }

    // ── Desktop Item (Perfect fixed 40px icon slot centered at 32px) ──
    return (
      <button
        key={item.id}
        onClick={() => handleTabSelect(item.id)}
        title={item.label}
        className={`w-full h-10 flex items-center rounded-xl text-[12.5px] transition-all duration-150 cursor-pointer relative group/item ${
          isActive ? activeClasses : inactiveClasses
        }`}
      >
        {/* Fixed icon slot: exactly 40px wide, centered in 48px button with ml-1 (4px left margin) */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center ml-1">
          <span className={`flex items-center justify-center ${
            isDanger
              ? (isActive ? 'text-rose-700 dark:text-rose-300' : 'text-rose-500 dark:text-rose-400')
              : isWarning
              ? (isActive ? 'text-amber-800 dark:text-amber-300' : 'text-amber-600 dark:text-amber-400')
              : (isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-200')
          }`}>
            {item.icon}
          </span>
        </div>

        {/* Label: expands smoothly when sidebar is hovered */}
        <span className="font-medium tracking-tight text-[12.5px] max-w-0 overflow-hidden group-hover/sidebar:max-w-[100px] transition-all duration-300 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 ml-0 group-hover/sidebar:ml-1.5 truncate">
          {item.label}
        </span>

        {/* Badge: ONLY rendered on hover in expanded state, absolutely no impact on collapsed layout */}
        {item.badge != null && item.badge > 0 && (
          <span className={`hidden group-hover/sidebar:inline-flex items-center justify-center ml-auto mr-2 text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center leading-tight shadow-xs ${
            item.id === 'inbox'
              ? 'bg-blue-600 text-white'
              : item.id === 'spam'
              ? 'bg-amber-200/90 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
              : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
          }`}>
            {item.badge}
          </span>
        )}

        {/* Collapsed unread dot indicator for inbox */}
        {item.id === 'inbox' && unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-950 group-hover/sidebar:hidden pointer-events-none" />
        )}
      </button>
    );
  };

  // Mobile drawer: always fully expanded, no hover behavior
  if (isMobileDrawer) {
    return (
      <aside className="w-72 max-w-[85vw] px-4 shadow-2xl bg-[#f4f5f9] dark:bg-slate-950 flex flex-col justify-between h-full py-4 select-none flex-shrink-0 z-20">
        {/* Top section */}
        <div className="flex flex-col space-y-4">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1">
            <Link to="/dashboard" className="flex items-center transition-opacity hover:opacity-85 py-0.5">
              <img
                src="/sandesh-wordmark.png"
                alt="संदेश"
                className="h-8 sm:h-9 w-auto sandesh-logo"
              />
            </Link>
            {onCloseMobileDrawer && (
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Quick Compose Button */}
          {onOpenCompose && (
            <div className="px-0.5">
              <button
                type="button"
                onClick={() => {
                  if (onCloseMobileDrawer) onCloseMobileDrawer();
                  onOpenCompose();
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)] hover:shadow-[0_6px_18px_-2px_rgba(37,99,235,0.55)] transition-all active:scale-95 cursor-pointer"
                title="Compose message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>Compose</span>
              </button>
            </div>
          )}

          {/* Operations Section */}
          <div className="flex flex-col space-y-1">
            <span className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pt-1">
              Operations
            </span>
            <nav className="flex flex-col space-y-1">
              {primaryNav.map(renderNavItem)}
            </nav>
          </div>

          {/* Mailboxes Section */}
          <div className="flex flex-col space-y-1 pt-1">
            <span className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pt-1">
              Mailboxes
            </span>
            <nav className="flex flex-col space-y-1">
              {foldersNav.map(renderNavItem)}
            </nav>
          </div>
        </div>
      </aside>
    );
  }

  // Desktop: hover-to-expand sidebar using CSS group hover
  return (
    <aside
      className="sidebar-hover-expand group/sidebar bg-[#f4f5f9] dark:bg-slate-950 flex flex-col justify-between h-full py-4 px-2 select-none flex-shrink-0 z-20 border-r border-slate-200/60 dark:border-slate-800/60"
    >
      {/* Top section: Brand + Navigation */}
      <div className="flex flex-col space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-center h-10 w-full overflow-hidden">
          <Link to="/dashboard" className="flex items-center justify-center transition-opacity hover:opacity-85">
            <img
              src="/sandesh-wordmark.png"
              alt="संदेश"
              className="h-9 xl:h-10 w-auto max-w-[44px] group-hover/sidebar:max-w-[140px] sandesh-logo flex-shrink-0 transition-all duration-300"
              style={{ objectFit: 'contain' }}
            />
          </Link>
        </div>

        {/* Quick Compose Button — perfectly aligned with the exact same 40px icon slot as nav items */}
        {onOpenCompose && (
          <div className="w-full">
            <button
              type="button"
              onClick={onOpenCompose}
              className="w-full h-10 flex items-center rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-[0_4px_14px_-2px_rgba(37,99,235,0.42)] hover:shadow-[0_6px_18px_-2px_rgba(37,99,235,0.52)] transition-all duration-200 active:scale-95 cursor-pointer overflow-hidden relative"
              title="Compose message"
            >
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center ml-1">
                <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="max-w-0 overflow-hidden group-hover/sidebar:max-w-[100px] opacity-0 group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap ml-0 group-hover/sidebar:ml-1.5 font-semibold text-xs">
                Compose
              </span>
            </button>
          </div>
        )}

        {/* Operations Section */}
        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1 max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-full group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap">
            Operations
          </span>
          <nav className="flex flex-col space-y-1">
            {primaryNav.map(renderNavItem)}
          </nav>
        </div>

        {/* Mailboxes Section */}
        <div className="flex flex-col space-y-1 pt-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1 max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-full group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap">
            Mailboxes
          </span>
          <nav className="flex flex-col space-y-1">
            {foldersNav.map(renderNavItem)}
          </nav>
        </div>
      </div>
    </aside>
  );
};

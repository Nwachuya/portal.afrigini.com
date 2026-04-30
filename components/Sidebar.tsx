'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserRecord, UserRole } from '@/types';
import { NavIconKey, getNavItems } from '@/lib/navigation';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  User,
  Search,
  Users,
  CreditCard,
  Building2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  user: UserRecord;
  userRole: UserRole;
  orgMembershipRole?: string | null;
  candidatePaymentsEligible?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void | Promise<void>;
}

export default function Sidebar({ user, userRole, orgMembershipRole, candidatePaymentsEligible, isOpen, onToggle, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const links = getNavItems(userRole, orgMembershipRole, candidatePaymentsEligible);

  const isActive = (href: string) => {
    if (href === pathname) return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  const initial = user.email ? user.email[0].toUpperCase() : 'U';

  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40 flex-col transition-all duration-200 ease-in-out ${
          isOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Top: Logo + Toggle */}
        <div className={`h-16 flex items-center border-b border-gray-200 ${isOpen ? 'justify-between px-3' : 'justify-center gap-1 px-1'}`}>
          {isOpen ? (
            <>
              <div className="relative h-8 w-[120px]">
                <Image
                  src="/afrigini_logo.png"
                  alt="Afrigini Logo"
                  fill
                  sizes="120px"
                  className="object-contain"
                  priority
                />
              </div>
            </>
          ) : (
            <>
              <span className="text-xl font-bold text-brand-green">A</span>
            </>
          )}
        </div>

        {/* Middle: Navigation Links */}
        <nav className="flex-1 flex flex-col gap-1 p-2 mt-2 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative ${
                isActive(link.href)
                  ? 'bg-brand-green/10 text-brand-green'
                  : 'text-gray-600 hover:bg-gray-100'
              } ${!isOpen ? 'justify-center' : ''}`}
            >
              <span className="flex-shrink-0">{getNavIcon(link.icon)}</span>
              {isOpen && <span className="text-sm font-medium">{link.label}</span>}

              {/* Tooltip on collapsed */}
              {!isOpen && (
                <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {link.label}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom: User + Logout */}
        <div className="border-t border-gray-200 p-2">
          {/* User info */}
          <div
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group relative ${
              !isOpen ? 'justify-center' : ''
            }`}
          >
            {user.avatar ? (
              <img
                src={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/users/${user.id}/${user.avatar}`}
                alt="Avatar"
                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {initial}
              </div>
            )}
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                <p className="text-xs text-gray-500 capitalize">{orgMembershipRole || userRole}</p>
              </div>
            )}

            {/* Tooltip on collapsed */}
            {!isOpen && (
              <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {user.email}
              </span>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors group relative ${
              !isOpen ? 'justify-center' : ''
            }`}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {isOpen && <span className="text-sm font-medium">Logout</span>}

            {/* Tooltip on collapsed */}
            {!isOpen && (
              <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Boundary toggle - Desktop only */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className={`hidden md:flex fixed top-8 -translate-y-1/2 -translate-x-1/2 h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-gray-700 hover:border-gray-300 transition-all z-50 ${
          isOpen ? 'left-60' : 'left-16'
        }`}
      >
        {isOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>
    </>
  );
}

function getNavIcon(icon: NavIconKey) {
  switch (icon) {
    case 'dashboard':
      return <LayoutDashboard size={20} />;
    case 'briefcase':
      return <Briefcase size={20} />;
    case 'fileText':
      return <FileText size={20} />;
    case 'user':
      return <User size={20} />;
    case 'search':
      return <Search size={20} />;
    case 'users':
      return <Users size={20} />;
    case 'creditCard':
      return <CreditCard size={20} />;
    case 'building2':
      return <Building2 size={20} />;
    case 'settings':
      return <Settings size={20} />;
  }
}

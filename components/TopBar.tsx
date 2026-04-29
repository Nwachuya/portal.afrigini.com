'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { UserRecord, UserRole } from '@/types';
import { getDefaultDashboardPath } from '@/lib/access';

interface TopBarProps {
  user: UserRecord;
  userRole: UserRole;
  orgMembershipRole?: string | null;
  mobileMenuOpen: boolean;
  onMenuClick: () => void;
}

export default function TopBar({
  user,
  userRole,
  orgMembershipRole,
  mobileMenuOpen,
  onMenuClick,
}: TopBarProps) {
  const initial = user.email ? user.email[0].toUpperCase() : 'U';
  const dashboardHref = getDefaultDashboardPath(userRole, orgMembershipRole);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 md:hidden">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left: Menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Center: Logo */}
        <Link href={dashboardHref}>
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
        </Link>

        {/* Right: Avatar */}
        <div className="h-9 w-9 rounded-full overflow-hidden">
          {user.avatar ? (
            <img
              src={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/users/${user.id}/${user.avatar}`}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {initial}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

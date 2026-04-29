'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <nav className="bg-white w-full border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-6 lg:px-12 h-20 flex justify-between items-center">
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-[150px]">
            <Image
              src="/afrigini_logo.png"
              alt="Afrigini Logo"
              fill
              sizes="150px"
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <Link 
            href="/login" 
            className="text-sm font-bold text-gray-600 hover:text-brand-green transition-colors"
          >
            Login
          </Link>
          <Link 
            href="/register" 
            className="px-6 py-2.5 text-sm font-bold bg-brand-green text-white rounded-lg hover:bg-green-800 transition-colors shadow-sm"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}

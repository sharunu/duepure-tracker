"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconRecord({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5.5V14.5M5.5 10H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 6.5H13.5M6.5 10H13.5M6.5 13.5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconStats({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4 16V10M8 16V7M12 16V4M16 16V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconAccount({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 17.5c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const navItems = [
  { href: "/battle", label: "記録", Icon: IconRecord },
  { href: "/battles", label: "履歴", Icon: IconHistory },
  { href: "/stats", label: "分析", Icon: IconStats },
  { href: "/account", label: "アカウント", Icon: IconAccount },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 safe-bottom z-50"
      style={{
        backgroundColor: "#181a2e",
        borderTop: "0.5px solid rgba(100,100,150,0.25)",
      }}
    >
      <div className="flex justify-around items-center h-[60px] max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
                isActive
                  ? "text-[#818cf8] font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <item.Icon />
              <span className="text-[10px] mt-1">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#6366f1] mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

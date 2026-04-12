"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkIsAdmin } from "@/lib/actions/admin-actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkIsAdmin().then((result) => {
      if (!result) router.replace("/account");
      else setIsAdmin(true);
    });
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}

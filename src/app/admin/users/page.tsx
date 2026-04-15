"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { getAdminUserList } from "@/lib/actions/admin-actions";

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  is_guest: boolean;
  created_at: string;
  battle_count: number;
  x_username: string | null;
  x_user_id: string | null;
};

type GuestFilter = "non-guest" | "guest";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [guestFilter, setGuestFilter] = useState<GuestFilter>("non-guest");

  useEffect(() => {
    getAdminUserList()
      .then((data) => {
        setUsers((data as unknown) as UserRow[]);
      })
      .catch((e) => {
        console.error('Failed to load users:', e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filtered = users
    .filter((u) => guestFilter === "guest" ? u.is_guest : !u.is_guest)
    .filter((u) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        (u.display_name?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q)) ||
        (u.x_username?.toLowerCase().includes(q))
      );
    });

  const guestCount = users.filter(u => u.is_guest).length;
  const nonGuestCount = users.filter(u => !u.is_guest).length;

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">ユーザー一覧</h1>
        <span className="text-[12px] text-gray-500 ml-auto">{users.length}人</span>
      </div>

      <div className="flex rounded-full bg-muted/30 p-1 mb-3">
        {(["non-guest", "guest"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setGuestFilter(f)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
              guestFilter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {f === "non-guest" ? `ゲスト以外 (${nonGuestCount})` : `ゲストのみ (${guestCount})`}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#232640] rounded-[8px] pl-9 pr-3 py-2.5 text-[13px] focus:outline-none"
          style={{ border: "0.5px solid #333355" }}
          placeholder="名前・メールで検索"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">該当するユーザーがいません</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const displayName = u.display_name || u.email || "名前未設定";
            const date = new Date(u.created_at);
            const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

            return (
              <button
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="w-full bg-[#232640] rounded-[10px] px-4 py-3 flex items-center gap-3 text-left hover:bg-[#2a2d4a] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate">{displayName}</span>
                    {u.is_guest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(136,136,170,0.12)] text-[#8888aa] shrink-0">
                        ゲスト
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-gray-500">{dateStr} 登録</span>
                    <span className="text-[11px] text-gray-500">{u.battle_count}戦</span>
                  </div>
                  {u.x_username && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-[#1d9bf0]"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://x.com/${u.x_username}`, '_blank'); }}
                      >@{u.x_username}</span>
                      {u.x_user_id && <span className="text-[10px] text-gray-600">(ID: {u.x_user_id})</span>}
                    </div>
                  )}
                </div>
                <span className="text-gray-500 text-[18px] shrink-0">&rsaquo;</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

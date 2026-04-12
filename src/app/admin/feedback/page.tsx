"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAdminFeedbackList } from "@/lib/actions/admin-actions";
import { FeedbackList } from "@/components/admin/FeedbackList";

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Awaited<ReturnType<typeof getAdminFeedbackList>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminFeedbackList().then((data) => {
      setFeedbacks(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">フィードバック</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <FeedbackList feedbacks={feedbacks} />
      )}
    </div>
  );
}

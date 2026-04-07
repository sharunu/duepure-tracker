"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="text-gray-400 text-[18px]"
        >
          &lsaquo;
        </button>
        <h1 className="text-[20px] font-medium">プライバシーポリシー</h1>
      </div>

      <div className="bg-[#232640] rounded-[10px] px-4 py-5 space-y-5 text-[13px] text-gray-300 leading-relaxed">
        <p className="text-[11px] text-gray-500">最終更新日: 2026年4月7日</p>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">1. 収集する情報</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>メールアドレス（メールログインの場合）</li>
            <li>SNSアカウント情報（Google/Xログインの場合、認証に必要な範囲のみ）</li>
            <li>ユーザー名（任意で設定）</li>
            <li>対戦記録データ（デッキ名、対戦結果、先攻/後攻など）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">2. 利用目的</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>ユーザー認証およびアカウント管理</li>
            <li>対戦記録の保存・表示・分析機能の提供</li>
            <li>環境統計データの集計・表示</li>
            <li>サービスの改善・不具合の修正</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">3. 第三者提供</h2>
          <p>
            収集した個人情報を第三者に提供することはありません。
            ただし、対戦記録データは匿名化された統計情報として環境分析に利用されます。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">4. Cookie・セッション</h2>
          <p>
            本サービスでは、認証情報の管理にSupabaseのセッションCookieを使用しています。
            これはログイン状態の維持に必要なもので、トラッキング目的では使用しません。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">5. データの保管</h2>
          <p>
            ユーザーデータはSupabase（クラウドデータベース）に保管されます。
            アカウントを削除した場合、関連するすべてのデータが削除されます。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-white mb-2">6. お問い合わせ</h2>
          <p>
            プライバシーに関するお問い合わせは、アプリ内の「ご意見・バグ報告」機能よりご連絡ください。
          </p>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import type { StatsShareData, DeckShareData } from "./ShareButton";
import { StatsShareCard } from "./StatsShareCard";
import { DeckShareCard } from "./DeckShareCard";

type Props = {
  type: "stats" | "deck" | "opponent";
  data: StatsShareData | DeckShareData;
  onClose: () => void;
};

export function ShareModal({ type, data, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [capturing, setCapturing] = useState(true);

  const appUrl = "http://54.152.11.99:3000";

  const shareText = (() => {
    if (type === "stats") {
      const d = data as StatsShareData;
      return `デュエプレトラッカーで戦績を記録中！\n勝率 ${d.winRate}%（${d.totalWins}勝${d.totalLosses}敗）\n${appUrl}`;
    } else if (type === "deck") {
      const d = data as DeckShareData;
      return `【${d.deckName}】勝率 ${d.winRate}%（${d.totalWins}勝${d.totalLosses}敗）\n${appUrl}`;
    } else {
      const d = data as DeckShareData;
      return `【vs ${d.deckName}】勝率 ${d.winRate}%（${d.totalWins}勝${d.totalLosses}敗）\n${appUrl}`;
    }
  })();

  useEffect(() => {
    const capture = async () => {
      if (!cardRef.current) return;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          width: 1200,
          height: 630,
        });
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            setImageUrl(URL.createObjectURL(blob));
          } else {
            setError(true);
          }
          setCapturing(false);
        }, "image/png");
      } catch {
        setError(true);
        setCapturing(false);
      }
    };
    // DOMレンダリング後にキャプチャ
    const timer = setTimeout(capture, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleMobileShare = async () => {
    if (!imageBlob) return;
    const file = new File([imageBlob], "duepure-stats.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: shareText, files: [file] });
      } catch {
        // ユーザーがキャンセル
      }
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = "duepure-stats.png";
    a.click();
  };

  const handleXPost = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener");
  };

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.canShare;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-[12px] overflow-hidden"
        style={{ backgroundColor: "#1a1d2e", border: "0.5px solid rgba(100,100,150,0.3)" }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[16px] font-medium">戦績をシェア</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* プレビュー */}
        <div className="px-5 pb-4">
          {capturing ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="animate-spin h-6 w-6 border-2 border-[#818cf8] border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-gray-400">画像の生成に失敗しました</p>
            </div>
          ) : imageUrl ? (
            <div className="rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="シェア画像プレビュー"
                className="w-full h-auto"
              />
            </div>
          ) : null}
        </div>

        {/* アクション */}
        <div className="px-5 pb-5 space-y-3">
          {isMobile && canNativeShare && imageBlob ? (
            <button
              onClick={handleMobileShare}
              className="w-full bg-[#6366f1] text-white rounded-[10px] px-4 py-3 text-[14px] font-medium hover:opacity-90"
            >
              シェアする
            </button>
          ) : (
            <>
              {imageBlob && (
                <button
                  onClick={handleDownload}
                  className="w-full bg-[#232640] text-white rounded-[10px] px-4 py-3 text-[14px] font-medium hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ border: "0.5px solid rgba(100,100,150,0.3)" }}
                >
                  <Download size={16} />
                  画像を保存
                </button>
              )}
              <button
                onClick={handleXPost}
                className="w-full bg-[#232640] text-white rounded-[10px] px-4 py-3 text-[14px] font-medium hover:opacity-90 flex items-center justify-center gap-2"
                style={{ border: "0.5px solid rgba(100,100,150,0.3)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Xに投稿
              </button>
            </>
          )}
        </div>
      </div>

      {/* 非表示のシェアカード（キャプチャ用） */}
      {type === "stats" ? (
        <StatsShareCard ref={cardRef} data={data as StatsShareData} />
      ) : (
        <DeckShareCard ref={cardRef} data={data as DeckShareData} type={type} />
      )}
    </div>
  );
}

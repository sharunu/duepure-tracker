import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

let fontCache: ArrayBuffer | undefined;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap"
  ).then((res) => res.text());
  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error("Font URL not found");
  const buf = await fetch(match[1]).then((res) => res.arrayBuffer());
  fontCache = buf;
  return buf;
}

const COLORS = ["#6366f1", "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

type StatsData = {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  secondWins: number;
  secondLosses: number;
  unknownWins?: number;
  unknownLosses?: number;
  encounterDistribution: { name: string; count: number; percentage: number; winRate?: number }[];
  period: string;
  format: string;
};

type DeckData = {
  deckName: string;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  secondWins: number;
  secondLosses: number;
  topMatchups: { name: string; wins: number; losses: number; winRate: number }[];
  period: string;
  format: string;
};

function renderStatsOg(d: StatsData) {
  const totalBattles = d.totalWins + d.totalLosses;
  const firstTotal = d.firstWins + d.firstLosses;
  const secondTotal = d.secondWins + d.secondLosses;
  const unknownWins = d.unknownWins ?? 0;
  const unknownLosses = d.unknownLosses ?? 0;
  const unknownTotal = unknownWins + unknownLosses;
  const firstRate = firstTotal > 0 ? Math.round((d.firstWins / firstTotal) * 100) : -1;
  const secondRate = secondTotal > 0 ? Math.round((d.secondWins / secondTotal) * 100) : -1;
  const unknownRate = unknownTotal > 0 ? Math.round((unknownWins / unknownTotal) * 100) : -1;

  const turnCards = [
    { label: "先攻", color: "#f0a030", wins: d.firstWins, losses: d.firstLosses, total: firstTotal, rate: firstRate },
    { label: "後攻", color: "#5b8def", wins: d.secondWins, losses: d.secondLosses, total: secondTotal, rate: secondRate },
    { label: "不明", color: "#666688", wins: unknownWins, losses: unknownLosses, total: unknownTotal, rate: unknownRate },
  ];

  const winRateColor = d.winRate >= 50 ? "#5b8def" : "#e85d75";
  const distribution = d.encounterDistribution ?? [];

  const DONUT_RADIUS = 100;
  const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

  const segments: Array<{ color: string; len: number; offset: number }> = [];
  {
    let cumulative = 0;
    distribution.forEach((item, i) => {
      const len = (CIRCUMFERENCE * item.percentage) / 100;
      const offset = -(cumulative * CIRCUMFERENCE) / 100;
      segments.push({ color: COLORS[i % COLORS.length], len, offset });
      cumulative += item.percentage;
    });
  }

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)",
        color: "#fff",
        fontFamily: "NotoSansJP",
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, color: "#818cf8", fontWeight: 700 }}>戦績サマリー</div>
        <div style={{ fontSize: 14, color: "#666" }}>{`${d.period} / ${d.format}`}</div>
      </div>

      {/* Donut + Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flex: 1, marginTop: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 14, color: "#818cf8", fontWeight: 700, marginBottom: 10 }}>対面デッキ分布</div>
          <div style={{ position: "relative", width: 240, height: 240, display: "flex" }}>
            {distribution.length > 0 ? (
              <>
                <svg width={240} height={240} viewBox="0 0 240 240">
                  <circle cx={120} cy={120} r={DONUT_RADIUS} fill="transparent" stroke="#1a1d3a" strokeWidth={40} />
                  {segments.map((seg, i) => (
                    <circle
                      key={i}
                      cx={120}
                      cy={120}
                      r={DONUT_RADIUS}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={40}
                      strokeDasharray={`${seg.len} ${CIRCUMFERENCE - seg.len}`}
                      strokeDashoffset={seg.offset}
                      transform="rotate(-90 120 120)"
                    />
                  ))}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    left: 40,
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    background: "#0f1129",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: 14, color: "#888" }}>勝率</div>
                  <div style={{ fontSize: 42, fontWeight: 700, color: winRateColor, display: "flex" }}>{`${d.winRate}%`}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{`${d.totalWins}勝${d.totalLosses}敗 / ${totalBattles}戦`}</div>
                </div>
              </>
            ) : (
              <div
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: "50%",
                  background: "#232640",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: 14,
                }}
              >
                データなし
              </div>
            )}
          </div>
        </div>

        {distribution.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 280, maxWidth: 360 }}>
            {distribution.slice(0, 6).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <div style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{item.name}</div>
                <div style={{ color: "#999", marginLeft: "auto", fontWeight: 700 }}>{`${item.percentage}%`}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Turn order cards */}
      <div style={{ display: "flex", gap: 14 }}>
        {turnCards.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: "#232640",
              borderRadius: 10,
              padding: "14px 16px",
              borderTop: `3px solid ${c.color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#8888aa" }}>勝率</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: c.rate >= 0 ? (c.rate >= 50 ? "#5b8def" : "#e85d75") : "#8888aa",
                  display: "flex",
                }}
              >
                {c.rate >= 0 ? `${c.rate}%` : "-"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#8888aa", marginTop: 2 }}>
              {c.total > 0 ? `${c.wins}勝${c.losses}敗 / ${c.total}戦` : "0戦"}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
        <div style={{ fontSize: 12, color: "#555" }}>{process.env.NEXT_PUBLIC_APP_URL ?? ""}</div>
      </div>
    </div>
  );
}

function renderDeckOg(d: DeckData, shareType: string) {
  const totalBattles = d.totalWins + d.totalLosses;
  const firstTotal = d.firstWins + d.firstLosses;
  const secondTotal = d.secondWins + d.secondLosses;
  const firstRate = firstTotal > 0 ? Math.round((d.firstWins / firstTotal) * 100) : 0;
  const secondRate = secondTotal > 0 ? Math.round((d.secondWins / secondTotal) * 100) : 0;

  const title = shareType === "opponent" ? `vs ${d.deckName}` : d.deckName;
  const matchupLabel = shareType === "opponent" ? "使用デッキ別" : "対面別勝率";

  return (
    <div style={{ width: 1200, height: 630, background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)", color: "#fff", fontFamily: "NotoSansJP", padding: 44, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>{`${d.period} / ${d.format}`}</div>
      </div>

      {/* Win rate + Turn order */}
      <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 20 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: d.winRate >= 50 ? "#5b8def" : "#e85d75" }}>{`${d.winRate}%`}</div>
          <div style={{ fontSize: 18, color: "#999", marginTop: 4 }}>{`${d.totalWins}勝 ${d.totalLosses}敗 / ${totalBattles}戦`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
            <div style={{ color: "#aaa", width: 40 }}>先攻</div>
            <div style={{ fontWeight: 700 }}>{`${firstRate}%`}</div>
            <div style={{ color: "#666", fontSize: 14 }}>{`(${d.firstWins}-${d.firstLosses})`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
            <div style={{ color: "#aaa", width: 40 }}>後攻</div>
            <div style={{ fontWeight: 700 }}>{`${secondRate}%`}</div>
            <div style={{ color: "#666", fontSize: 14 }}>{`(${d.secondWins}-${d.secondLosses})`}</div>
          </div>
        </div>
      </div>

      {/* Matchups Top5 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 24, flex: 1 }}>
        <div style={{ fontSize: 14, color: "#818cf8", marginBottom: 12, fontWeight: 700 }}>{`${matchupLabel} Top5`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.topMatchups.slice(0, 5).map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16 }}>
              <div style={{ color: "#ccc", overflow: "hidden", maxWidth: 500 }}>{m.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", fontWeight: 700, flexShrink: 0, marginLeft: 16 }}>
                <span>{`${m.winRate}%`}</span>
                <span style={{ color: "#666", fontSize: 13, marginLeft: 4 }}>{`(${m.wins}-${m.losses})`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
        <div style={{ fontSize: 13, color: "#555" }}>{process.env.NEXT_PUBLIC_APP_URL ?? ""}</div>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: share } = await supabase
    .from("shares")
    .select("share_type, share_data")
    .eq("id", id)
    .single();

  if (!share) {
    return new Response("Not found", { status: 404 });
  }

  const font = await getFont();

  const element =
    share.share_type === "stats"
      ? renderStatsOg(share.share_data as unknown as StatsData)
      : renderDeckOg(share.share_data as unknown as DeckData, share.share_type);

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "NotoSansJP", data: font, weight: 700 as const, style: "normal" as const },
    ],
    headers: {
      "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
    },
  });
}

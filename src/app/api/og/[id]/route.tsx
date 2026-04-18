import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const FONT_CACHE: { regular?: ArrayBuffer; bold?: ArrayBuffer } = {};

async function getFontFromGoogle(weight: 400 | 700): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  ).then((res) => res.text());
  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error("Font URL not found");
  return fetch(match[1]).then((res) => res.arrayBuffer());
}

async function getFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (!FONT_CACHE.regular) FONT_CACHE.regular = await getFontFromGoogle(400);
  if (!FONT_CACHE.bold) FONT_CACHE.bold = await getFontFromGoogle(700);
  return { regular: FONT_CACHE.regular, bold: FONT_CACHE.bold };
}

const CHIP_COLORS = ["#818cf8", "#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

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

function winRateColor(rate: number): string {
  if (rate < 0) return "#8a8fa3";
  if (rate >= 50) return "#5b8def";
  return "#e85d75";
}

function TurnRow({ label, color, wins, losses, total, rate }: { label: string; color: string; wins: number; losses: number; total: number; rate: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 92,
        background: "#1a1d3a",
        borderRadius: 14,
        padding: "0 28px 0 0",
        borderLeft: `5px solid ${color}`,
        paddingLeft: 23,
        gap: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 20,
          fontWeight: 700,
          color: color,
          minWidth: 60,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontSize: 54,
          fontWeight: 700,
          color: rate >= 0 ? winRateColor(rate) : "#55586e",
          minWidth: 150,
          lineHeight: 1,
        }}
      >
        {rate >= 0 ? `${rate}%` : "—"}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: "auto",
          alignItems: "flex-end",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#d6dae8", display: "flex" }}>
          {total > 0 ? `${wins}-${losses}` : "—"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 2 }}>
          {total > 0 ? `${total}戦` : "0戦"}
        </div>
      </div>
    </div>
  );
}

function renderStatsOg(d: StatsData, appUrl: string) {
  const totalBattles = d.totalWins + d.totalLosses;
  const firstTotal = d.firstWins + d.firstLosses;
  const secondTotal = d.secondWins + d.secondLosses;
  const unknownWins = d.unknownWins ?? 0;
  const unknownLosses = d.unknownLosses ?? 0;
  const unknownTotal = unknownWins + unknownLosses;
  const firstRate = firstTotal > 0 ? Math.round((d.firstWins / firstTotal) * 100) : -1;
  const secondRate = secondTotal > 0 ? Math.round((d.secondWins / secondTotal) * 100) : -1;
  const unknownRate = unknownTotal > 0 ? Math.round((unknownWins / unknownTotal) * 100) : -1;

  const heroColor = winRateColor(d.winRate);
  const distribution = (d.encounterDistribution ?? []).slice(0, 5);

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: "linear-gradient(135deg, #0b0d24 0%, #1a1d3a 55%, #0b0d24 100%)",
        color: "#fff",
        fontFamily: "NotoSansJP",
        padding: "36px 56px 26px 56px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: "#cbd0e0", letterSpacing: 0.5 }}>
            デュエプレトラッカー
          </div>
          <div style={{ width: 1, height: 18, background: "#3a3d55" }} />
          <div style={{ fontSize: 15, fontWeight: 400, color: "#8a8fa3" }}>戦績サマリー</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: "#8a8fa3" }}>{`${d.period} · ${d.format}`}</div>
      </div>

      {/* Main: Hero win rate + Turn stats stack */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, marginTop: 16 }}>
        {/* Left: Hero win rate */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 400, color: "#9aa0b4", letterSpacing: 2 }}>
            WIN RATE
          </div>
          <div
            style={{
              fontSize: 200,
              fontWeight: 700,
              color: heroColor,
              lineHeight: 1,
              display: "flex",
              marginTop: 4,
              letterSpacing: -4,
            }}
          >
            {`${d.winRate}%`}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 18 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#e8eaf4", display: "flex" }}>
              {`${d.totalWins}勝 ${d.totalLosses}敗`}
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, color: "#8a8fa3" }}>{`/ ${totalBattles}戦`}</div>
          </div>
        </div>

        {/* Right: Turn stats */}
        <div style={{ display: "flex", flexDirection: "column", width: 560, gap: 14 }}>
          <TurnRow label="先攻" color="#f0a030" wins={d.firstWins} losses={d.firstLosses} total={firstTotal} rate={firstRate} />
          <TurnRow label="後攻" color="#5b8def" wins={d.secondWins} losses={d.secondLosses} total={secondTotal} rate={secondRate} />
          <TurnRow label="不明" color="#8a8aa0" wins={unknownWins} losses={unknownLosses} total={unknownTotal} rate={unknownRate} />
        </div>
      </div>

      {/* Bottom: Matchup chips */}
      {distribution.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 1.5 }}>
            MATCHUPS
          </div>
          {distribution.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: "rgba(26,29,58,0.7)",
                borderRadius: 999,
                border: "1px solid #2a2d48",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: CHIP_COLORS[i % CHIP_COLORS.length],
                }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#d6dae8",
                  maxWidth: 130,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: item.winRate !== undefined ? winRateColor(item.winRate) : "#9aa0b4",
                }}
              >
                {item.winRate !== undefined ? `${item.winRate}%` : `${item.percentage}%`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 400, color: "#55586e", letterSpacing: 0.3 }}>{appUrl}</div>
      </div>
    </div>
  );
}

function renderDeckOg(d: DeckData, shareType: string, appUrl: string) {
  const totalBattles = d.totalWins + d.totalLosses;
  const firstTotal = d.firstWins + d.firstLosses;
  const secondTotal = d.secondWins + d.secondLosses;
  const firstRate = firstTotal > 0 ? Math.round((d.firstWins / firstTotal) * 100) : 0;
  const secondRate = secondTotal > 0 ? Math.round((d.secondWins / secondTotal) * 100) : 0;

  const title = shareType === "opponent" ? `vs ${d.deckName}` : d.deckName;
  const matchupLabel = shareType === "opponent" ? "使用デッキ別" : "対面別勝率";

  return (
    <div style={{ width: 1200, height: 630, background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)", color: "#fff", fontFamily: "NotoSansJP", padding: 44, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 400, color: "#666", marginTop: 4 }}>{`${d.period} / ${d.format}`}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 20 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: d.winRate >= 50 ? "#5b8def" : "#e85d75" }}>{`${d.winRate}%`}</div>
          <div style={{ fontSize: 18, fontWeight: 400, color: "#999", marginTop: 4 }}>{`${d.totalWins}勝 ${d.totalLosses}敗 / ${totalBattles}戦`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
            <div style={{ color: "#aaa", width: 40, fontWeight: 400 }}>先攻</div>
            <div style={{ fontWeight: 700 }}>{`${firstRate}%`}</div>
            <div style={{ color: "#666", fontSize: 14, fontWeight: 400 }}>{`(${d.firstWins}-${d.firstLosses})`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
            <div style={{ color: "#aaa", width: 40, fontWeight: 400 }}>後攻</div>
            <div style={{ fontWeight: 700 }}>{`${secondRate}%`}</div>
            <div style={{ color: "#666", fontSize: 14, fontWeight: 400 }}>{`(${d.secondWins}-${d.secondLosses})`}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 24, flex: 1 }}>
        <div style={{ fontSize: 14, color: "#818cf8", marginBottom: 12, fontWeight: 700 }}>{`${matchupLabel} Top5`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.topMatchups.slice(0, 5).map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16 }}>
              <div style={{ color: "#ccc", fontWeight: 400, overflow: "hidden", maxWidth: 500 }}>{m.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", fontWeight: 700, flexShrink: 0, marginLeft: 16 }}>
                <span>{`${m.winRate}%`}</span>
                <span style={{ color: "#666", fontSize: 13, fontWeight: 400, marginLeft: 4 }}>{`(${m.wins}-${m.losses})`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
        <div style={{ fontSize: 13, fontWeight: 400, color: "#555" }}>{appUrl}</div>
      </div>
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const url = new URL(request.url);
  const appUrl = `${url.protocol}//${url.host}`;

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

  const fonts = await getFonts();

  const element =
    share.share_type === "stats"
      ? renderStatsOg(share.share_data as unknown as StatsData, appUrl)
      : renderDeckOg(share.share_data as unknown as DeckData, share.share_type, appUrl);

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "NotoSansJP", data: fonts.regular, weight: 400 as const, style: "normal" as const },
      { name: "NotoSansJP", data: fonts.bold, weight: 700 as const, style: "normal" as const },
    ],
    headers: {
      "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
    },
  });
}

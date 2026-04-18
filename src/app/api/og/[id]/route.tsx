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

const COLORS = ["#818cf8", "#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

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

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polar(cx, cy, rOuter, endAngle);
  const endOuter = polar(cx, cy, rOuter, startAngle);
  const startInner = polar(cx, cy, rInner, startAngle);
  const endInner = polar(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    "M", startOuter.x.toFixed(2), startOuter.y.toFixed(2),
    "A", rOuter, rOuter, 0, largeArc, 0, endOuter.x.toFixed(2), endOuter.y.toFixed(2),
    "L", startInner.x.toFixed(2), startInner.y.toFixed(2),
    "A", rInner, rInner, 0, largeArc, 1, endInner.x.toFixed(2), endInner.y.toFixed(2),
    "Z",
  ].join(" ");
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

  const turnCards = [
    { label: "先攻", color: "#f0a030", wins: d.firstWins, losses: d.firstLosses, total: firstTotal, rate: firstRate },
    { label: "後攻", color: "#5b8def", wins: d.secondWins, losses: d.secondLosses, total: secondTotal, rate: secondRate },
    { label: "不明", color: "#8a8aa0", wins: unknownWins, losses: unknownLosses, total: unknownTotal, rate: unknownRate },
  ];

  const winRateColor = d.winRate >= 50 ? "#5b8def" : "#e85d75";
  const distribution = d.encounterDistribution ?? [];

  const CX = 130;
  const CY = 130;
  const R_OUTER = 120;
  const R_INNER = 78;

  type Seg = { color: string; path: string };
  const segments: Seg[] = [];
  {
    let startAngle = 0;
    distribution.forEach((item, i) => {
      const endAngle = startAngle + (item.percentage * 360) / 100;
      if (endAngle > startAngle) {
        const safeEnd = endAngle >= 360 ? 359.99 : endAngle;
        segments.push({
          color: COLORS[i % COLORS.length],
          path: arcPath(CX, CY, R_OUTER, R_INNER, startAngle, safeEnd),
        });
      }
      startAngle = endAngle;
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
        padding: "28px 56px 22px 56px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
          <div style={{ width: 1, height: 20, background: "#3a3d55" }} />
          <div style={{ fontSize: 16, fontWeight: 400, color: "#cbd0e0" }}>戦績サマリー</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: "#888" }}>{`${d.period} / ${d.format}`}</div>
      </div>

      {/* Main body: Donut + Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 64, flex: 1 }}>
        {/* Donut */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: 260, height: 260, display: "flex" }}>
            {distribution.length > 0 ? (
              <>
                <svg width={260} height={260} viewBox="0 0 260 260" style={{ position: "absolute", top: 0, left: 0 }}>
                  <circle cx={CX} cy={CY} r={(R_OUTER + R_INNER) / 2} fill="none" stroke="#1a1d3a" strokeWidth={R_OUTER - R_INNER} />
                  {segments.map((seg, i) => (
                    <path key={i} d={seg.path} fill={seg.color} />
                  ))}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: CY - R_INNER + 4,
                    left: CX - R_INNER + 4,
                    width: (R_INNER - 4) * 2,
                    height: (R_INNER - 4) * 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#9aa0b4" }}>勝率</div>
                  <div style={{ fontSize: 52, fontWeight: 700, color: winRateColor, lineHeight: 1, display: "flex", marginTop: 2 }}>
                    {`${d.winRate}%`}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 6 }}>
                    {`${d.totalWins}勝${d.totalLosses}敗 / ${totalBattles}戦`}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  width: 260,
                  height: 260,
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginTop: 10 }}>対面デッキ分布</div>
        </div>

        {/* Legend */}
        {distribution.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 320 }}>
            {distribution.slice(0, 6).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <div
                  style={{
                    color: "#d6dae8",
                    fontWeight: 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 240,
                  }}
                >
                  {item.name}
                </div>
                <div style={{ color: "#9aa0b4", marginLeft: "auto", fontWeight: 700 }}>{`${item.percentage}%`}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Turn order cards */}
      <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
        {turnCards.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: "#232640",
              borderRadius: 12,
              padding: "16px 20px 14px 20px",
              borderTop: `3px solid ${c.color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3" }}>勝率</div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: c.rate >= 0 ? (c.rate >= 50 ? "#5b8def" : "#e85d75") : "#8a8fa3",
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {c.rate >= 0 ? `${c.rate}%` : "-"}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 4 }}>
              {c.total > 0 ? `${c.wins}勝${c.losses}敗 / ${c.total}戦` : "0戦"}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 400, color: "#555" }}>{appUrl}</div>
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

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

const COLORS = ["#6366f1", "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#777"];

type StatsData = {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  secondWins: number;
  secondLosses: number;
  topMyDecks: { name: string; wins: number; losses: number; winRate: number }[];
  topOpponentDecks: { name: string; wins: number; losses: number; winRate: number }[];
  encounterDistribution: { name: string; count: number; percentage: number }[];
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

function DeckBar({ name, winRate, wins, losses, maxWidth }: { name: string; winRate: number; wins: number; losses: number; maxWidth: number }) {
  return (
    <div style={{ marginBottom: 10, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
        <div style={{ color: "#ccc", overflow: "hidden", maxWidth }}>{name}</div>
        <div style={{ display: "flex", alignItems: "baseline", fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
          <span>{`${winRate}%`}</span>
          <span style={{ color: "#666", fontSize: 11, marginLeft: 4 }}>{`(${wins}-${losses})`}</span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "#1e2138", display: "flex" }}>
        <div style={{ height: "100%", width: `${winRate}%`, borderRadius: 2, background: winRate >= 50 ? "#5b8def" : "#e85d75" }} />
      </div>
    </div>
  );
}

function renderStatsOg(d: StatsData) {
  const totalBattles = d.totalWins + d.totalLosses;
  const firstTotal = d.firstWins + d.firstLosses;
  const secondTotal = d.secondWins + d.secondLosses;
  const firstRate = firstTotal > 0 ? Math.round((d.firstWins / firstTotal) * 100) : 0;
  const secondRate = secondTotal > 0 ? Math.round((d.secondWins / secondTotal) * 100) : 0;

  return (
    <div style={{ width: 1200, height: 630, background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)", color: "#fff", fontFamily: "NotoSansJP", padding: "36px 44px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, color: "#818cf8", fontWeight: 700 }}>戦績サマリー</div>
        <div style={{ fontSize: 13, color: "#555" }}>{`${d.period} / ${d.format}`}</div>
      </div>

      {/* Win rate + Turn order */}
      <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200 }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: d.winRate >= 50 ? "#5b8def" : "#e85d75" }}>{`${d.winRate}%`}</div>
          <div style={{ fontSize: 16, color: "#888", marginTop: 4 }}>{`${d.totalWins}勝 ${d.totalLosses}敗 / ${totalBattles}戦`}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ background: "rgba(99,102,241,0.12)", borderRadius: 12, padding: "12px 22px", minWidth: 130, display: "flex", flexDirection: "column", alignItems: "center", border: "1px solid rgba(99,102,241,0.25)" }}>
            <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700 }}>先攻</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", marginTop: 4 }}>{`${firstRate}%`}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{`${d.firstWins}勝 ${d.firstLosses}敗`}</div>
          </div>
          <div style={{ background: "rgba(56,189,248,0.12)", borderRadius: 12, padding: "12px 22px", minWidth: 130, display: "flex", flexDirection: "column", alignItems: "center", border: "1px solid rgba(56,189,248,0.25)" }}>
            <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>後攻</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", marginTop: 4 }}>{`${secondRate}%`}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{`${d.secondWins}勝 ${d.secondLosses}敗`}</div>
          </div>
        </div>
      </div>

      {/* Distribution bar + Deck lists */}
      <div style={{ display: "flex", gap: 32, flex: 1, marginTop: 20 }}>
        {d.encounterDistribution.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 220, maxWidth: 220 }}>
            <div style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, marginBottom: 10 }}>対面分布</div>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", width: "100%" }}>
              {d.encounterDistribution.slice(0, 5).map((item, i) => (
                <div key={i} style={{ width: `${item.percentage}%`, height: "100%", backgroundColor: COLORS[i % COLORS.length] }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
              {d.encounterDistribution.slice(0, 5).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <div style={{ color: "#999", overflow: "hidden", maxWidth: 140 }}>{item.name}</div>
                  <div style={{ color: "#666", marginLeft: "auto", flexShrink: 0 }}>{`${item.percentage}%`}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, color: "#818cf8", marginBottom: 10, fontWeight: 700 }}>使用デッキ Top3</div>
          {d.topMyDecks.slice(0, 3).map((deck, i) => (
            <DeckBar key={i} name={deck.name} winRate={deck.winRate} wins={deck.wins} losses={deck.losses} maxWidth={200} />
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, color: "#818cf8", marginBottom: 10, fontWeight: 700 }}>対面デッキ Top3</div>
          {d.topOpponentDecks.slice(0, 3).map((deck, i) => (
            <DeckBar key={i} name={deck.name} winRate={deck.winRate} wins={deck.wins} losses={deck.losses} maxWidth={200} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
        <div style={{ fontSize: 12, color: "#555" }}>http://54.152.11.99:3000</div>
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
        <div style={{ fontSize: 13, color: "#555" }}>http://54.152.11.99:3000</div>
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

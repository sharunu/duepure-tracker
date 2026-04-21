/**
 * Cloudflare Workers runtime の Secret 型環境変数は process.env に露出しないため、
 * OpenNext の getCloudflareContext() 経由で取り出す。
 * EC2 Docker / ローカル dev など process.env が生きている環境もサポートするため
 * フォールバックも含める。
 *
 * 参考: https://opennext.js.org/cloudflare/bindings
 */

type CfEnv = Record<string, string | undefined>;

export async function getServerEnv(key: string): Promise<string | undefined> {
  // 1) process.env (Node.js / EC2 / NEXT_PUBLIC_* inline)
  const fromProcess = typeof process !== "undefined" ? process.env?.[key] : undefined;
  if (fromProcess) return fromProcess;

  // 2) getCloudflareContext().env (Cloudflare Workers runtime)
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = mod.getCloudflareContext?.();
    const cfEnv = (ctx?.env ?? {}) as CfEnv;
    return cfEnv[key];
  } catch {
    return undefined;
  }
}

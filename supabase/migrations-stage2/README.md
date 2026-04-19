# Stage 2 マイグレーション（未適用）

このフォルダのマイグレーションは **Stage 1 → コード main 反映 → 24h監視後** にのみ適用すること。

手順:
1. main マージ後24時間監視し、Cloudflare Workers ログ・Supabase discord_connections の新規INSERTに異常がないことを確認
2. このファイルを `supabase/migrations/` へ移動
3. ローカルで `npx supabase db push` を実行
4. ポケポケ home の Discord ボタン disabled 解除コードを dev→main にpush

詳細は `/Users/nakatataketo/.claude/plans/pok-mon-trading-card-cached-moon.md` 参照

-- Phase A (20260509000004) で削除した share-images SELECT policy を、
-- public 全許可ではなく authenticated 本人 prefix 限定で復元する。
--
-- 背景:
--   Phase A の "Public can read share images" 削除は listing 塞ぎが目的だったが、
--   ShareModal の supabase.storage.from("share-images").upload(filePath, blob, { upsert: true })
--   が SELECT 権限を要求する Supabase storage-api 仕様 (公式 docs: upsert には SELECT/UPDATE が必要)
--   のため silent failure するようになった。shares.image_url が NULL のまま保存され、
--   og:image が /api/og/[id] フォールバックになり X クローラーが画像取得できない状態に陥った。
--
-- 設計:
--   - SELECT policy "Users can read own share images" を新設、authenticated + 本人 prefix 限定
--   - upsert に必要な SELECT は本人 prefix で通るため復旧
--   - anon の listing は塞いだまま (Phase A の listing 塞ぎ意図を維持、public 全許可より厳しい)
--   - public bucket の公開URL配信 (/storage/v1/object/public/...) は RLS bypass のため
--     X クローラー (anon) でも引き続き取得可能
--   - 既存 INSERT "Users can upload own share images" / UPDATE "Users can update own share images"
--     (20260424000001:467 / 同:472) と prefix 条件 ((storage.foldername(name))[1] = auth.uid()::text)
--     が一致、upsert の 3 要件 (SELECT + INSERT + UPDATE) が揃う
--   - ShareModal の保存先 ${user.id}/${id}.png (ShareModal.tsx:125) と完全に対応

DROP POLICY IF EXISTS "Public can read share images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own share images" ON storage.objects;

CREATE POLICY "Users can read own share images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'share-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- ロールバック用 SQL (必要時に手動で流す):
--   DROP POLICY IF EXISTS "Users can read own share images" ON storage.objects;
--   CREATE POLICY "Public can read share images"
--     ON storage.objects FOR SELECT USING (bucket_id = 'share-images');
-- =============================================================================

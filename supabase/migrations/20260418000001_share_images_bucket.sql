-- Add image_url column to shares for storing uploaded preview images
ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS image_url text;

-- Create public bucket for share images (5MB limit, PNG only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('share-images', 'share-images', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload to share-images bucket
DROP POLICY IF EXISTS "Authenticated users can upload share images" ON storage.objects;
CREATE POLICY "Authenticated users can upload share images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'share-images');

-- Allow public read of share images (required so X/Twitter can fetch og:image)
DROP POLICY IF EXISTS "Public can read share images" ON storage.objects;
CREATE POLICY "Public can read share images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'share-images');

-- Allow authenticated users to overwrite their own share images (upsert support)
DROP POLICY IF EXISTS "Authenticated users can update share images" ON storage.objects;
CREATE POLICY "Authenticated users can update share images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'share-images');

-- RLS policies for anonymous access to shared links and related data.
-- These allow the public /share/:slug page to fetch data without authentication.

-- Allow anon to read active shared links by slug
CREATE POLICY "anon_read_shared_links"
  ON shared_links
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Allow anon to read tracks referenced by an active shared link
CREATE POLICY "anon_read_tracks_via_shared_link"
  ON tracks
  FOR SELECT
  TO anon
  USING (
    id IN (SELECT track_id FROM shared_links WHERE status = 'active' AND track_id IS NOT NULL)
    OR id IN (
      SELECT pt.track_id
      FROM playlist_tracks pt
      JOIN shared_links sl ON sl.playlist_id = pt.playlist_id
      WHERE sl.status = 'active'
    )
  );

-- Allow anon to read playlists referenced by an active shared link
CREATE POLICY "anon_read_playlists_via_shared_link"
  ON playlists
  FOR SELECT
  TO anon
  USING (
    id IN (SELECT playlist_id FROM shared_links WHERE status = 'active' AND playlist_id IS NOT NULL)
  );

-- Allow anon to read playlist_tracks for playlists in active shared links
CREATE POLICY "anon_read_playlist_tracks_via_shared_link"
  ON playlist_tracks
  FOR SELECT
  TO anon
  USING (
    playlist_id IN (SELECT playlist_id FROM shared_links WHERE status = 'active' AND playlist_id IS NOT NULL)
  );

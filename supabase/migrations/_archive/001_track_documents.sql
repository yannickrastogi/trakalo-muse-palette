-- ENUM
CREATE TYPE document_status AS ENUM ('draft', 'pending', 'signed');

-- Table
CREATE TABLE track_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id uuid NOT NULL REFERENCES tracks(uuid) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  status document_status NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_track_documents_track_id ON track_documents(track_id);
CREATE INDEX idx_track_documents_workspace_id ON track_documents(workspace_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_track_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_documents_updated_at
  BEFORE UPDATE ON track_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_track_documents_updated_at();

-- RLS
ALTER TABLE track_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view documents"
  ON track_documents FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert documents"
  ON track_documents FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update documents"
  ON track_documents FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Uploader or admin can delete documents"
  ON track_documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

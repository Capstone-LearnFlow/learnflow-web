-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to chat_messages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'chat_messages' 
                 AND column_name = 'embedding') THEN
    ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);
  END IF;
END
$$;

-- Create index on embedding column for faster similarity search
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chat_messages_embedding_idx') THEN
    CREATE INDEX chat_messages_embedding_idx ON chat_messages USING ivfflat (embedding vector_cosine_ops);
  END IF;
END
$$;

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_chat_messages(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_assignment_id text
)
RETURNS TABLE (
  id uuid,
  assignment_id text,
  parent_node_id text,
  node_id text,
  sender text,
  message text,
  created_at timestamptz,
  mode text,
  user_id text,
  user_name text,
  suggestions jsonb,
  citations jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.assignment_id,
    cm.parent_node_id,
    cm.node_id,
    cm.sender,
    cm.message,
    cm.created_at,
    cm.mode,
    cm.user_id,
    cm.user_name,
    cm.suggestions,
    cm.citations,
    1 - (cm.embedding <=> query_embedding) as similarity
  FROM
    chat_messages cm
  WHERE
    cm.assignment_id = p_assignment_id
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY
    cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add a comment explaining the purpose of this file
COMMENT ON FUNCTION match_chat_messages IS 'Searches for chat messages with similar embeddings using cosine distance';
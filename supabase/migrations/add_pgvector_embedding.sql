-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to chat_messages table with proper dimensions
DO $$
BEGIN
  -- First check if the column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'chat_messages' 
                 AND column_name = 'embedding') THEN
    -- Add embedding column with proper dimensions (1536 for text-embedding-3-small model)
    ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);
  ELSE
    -- If column exists but is not a vector type with dimensions, recreate it
    BEGIN
      -- This will fail if the column is not a vector type or doesn't have dimensions
      EXECUTE 'ALTER TABLE chat_messages ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536)';
    EXCEPTION WHEN OTHERS THEN
      -- If the above fails, drop and recreate the column
      ALTER TABLE chat_messages DROP COLUMN embedding;
      ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);
    END;
  END IF;
END
$$;

-- Create index on embedding column for faster similarity search
-- Only create the index if the embedding column exists and has proper dimensions
DO $$
BEGIN
  -- Verify the column exists and has proper type before creating index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_messages' 
    AND column_name = 'embedding'
  ) THEN
    -- Check if index already exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chat_messages_embedding_idx') THEN
      -- Create the index with the proper operator class
      EXECUTE 'CREATE INDEX chat_messages_embedding_idx ON chat_messages USING ivfflat (embedding vector_cosine_ops)';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating index: %', SQLERRM;
END
$$;

-- Check and convert json columns to jsonb if needed
DO $$
DECLARE
  suggestions_type text;
  citations_type text;
BEGIN
  -- Get current column types
  SELECT data_type INTO suggestions_type 
  FROM information_schema.columns 
  WHERE table_name = 'chat_messages' AND column_name = 'suggestions';
  
  SELECT data_type INTO citations_type 
  FROM information_schema.columns 
  WHERE table_name = 'chat_messages' AND column_name = 'citations';
  
  -- Convert json to jsonb if needed
  IF suggestions_type = 'json' THEN
    ALTER TABLE chat_messages ALTER COLUMN suggestions TYPE jsonb USING suggestions::jsonb;
    RAISE NOTICE 'Converted suggestions column from json to jsonb';
  END IF;
  
  IF citations_type = 'json' THEN
    ALTER TABLE chat_messages ALTER COLUMN citations TYPE jsonb USING citations::jsonb;
    RAISE NOTICE 'Converted citations column from json to jsonb';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error checking or converting column types: %', SQLERRM;
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
    CASE
      WHEN pg_typeof(cm.suggestions) = 'json'::regtype THEN cm.suggestions::jsonb
      ELSE cm.suggestions
    END AS suggestions,
    CASE
      WHEN pg_typeof(cm.citations) = 'json'::regtype THEN cm.citations::jsonb
      ELSE cm.citations
    END AS citations,
    1 - (cm.embedding <=> query_embedding) as similarity
  FROM
    chat_messages cm
  WHERE
    cm.assignment_id = p_assignment_id
    AND cm.embedding IS NOT NULL
    AND cm.sender = 'AI' -- Only retrieve AI messages
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY
    cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add a comment explaining the purpose of this file
COMMENT ON FUNCTION match_chat_messages IS 'Searches for chat messages with similar embeddings using cosine distance';
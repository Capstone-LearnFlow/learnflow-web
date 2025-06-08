# OpenAI Text Embeddings for Chat Semantic Search

This feature adds OpenAI text embeddings to chat messages and enables semantic search to retrieve related messages across different nodes in the research interface.

## Features

- Automatically generates OpenAI text embeddings for all chat messages
- Stores embeddings in Supabase using pgvector extension
- Enables semantic search across chat messages from different nodes
- Displays relevant messages from other nodes in the global research chat
- Visually distinguishes retrieved messages with node context

## Setup Requirements

### 1. Enable pgvector in Supabase

The pgvector extension needs to be enabled in your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to Database → Extensions
3. Enable the "vector" extension

### 2. Run Migration

Execute the SQL migration script to set up the necessary database structure:

```sql
-- Run the migration in supabase/migrations/add_pgvector_embedding.sql
```

This will:
- Enable the pgvector extension
- Add an embedding column to the chat_messages table
- Create an index for faster similarity search
- Create a function for vector similarity search

### 3. Update Environment Variables

Ensure your environment has the proper OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key (if using from client side)
```

## How It Works

1. **Embedding Generation**: When a chat message is saved, the system automatically generates an OpenAI text embedding using the "text-embedding-3-small" model.

2. **Storage**: The embedding is stored as a vector in the chat_messages table in Supabase.

3. **Retrieval**: In the global research chat (nodeId='0'), when a user asks a question, the system:
   - Generates an embedding for the question
   - Performs a vector similarity search to find related messages from other nodes
   - Displays relevant messages with context about which node they came from
   - Includes these relevant messages as context for the AI's response

4. **Visual Distinction**: Retrieved messages from other nodes are displayed with a distinctive style and include information about their source node.

## Technical Details

- The embedding function uses OpenAI's "text-embedding-3-small" model
- Embedding vectors have 1536 dimensions
- The similarity search uses cosine similarity with a customizable threshold
- The number of retrieved messages can be configured (default: 5)

## Troubleshooting

If you encounter issues:

1. **Check pgvector Extension**: Ensure the vector extension is properly enabled in Supabase
2. **Verify API Keys**: Make sure your OpenAI API key is valid and has permission to use the embedding model
3. **Check Migration**: Verify the SQL migration was executed successfully
4. **Inspect Embedding Values**: You can check if embeddings are being properly stored with a query:
   ```sql
   SELECT id, message, embedding IS NOT NULL as has_embedding 
   FROM chat_messages 
   ORDER BY created_at DESC LIMIT 10;
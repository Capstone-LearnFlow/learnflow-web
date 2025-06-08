# OpenAI Text Embeddings for Chat Semantic Search

This feature adds OpenAI text embeddings to chat messages and enables semantic search to retrieve related messages across different nodes in the research interface.

## Features

- Automatically generates OpenAI text embeddings for all chat messages via a secure server-side API
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

Ensure your environment has the proper OpenAI API key (server-side only):

```
OPENAI_API_KEY=your_openai_api_key
```

Note: The API key is only used server-side to maintain security. Never expose your OpenAI API key to the client.

## How It Works

1. **Secure Server-Side Architecture**: All OpenAI API calls are made server-side through a dedicated API endpoint (/api/embedding) to protect API keys.

2. **Embedding Generation**: When a chat message is saved, the system:
   - Makes a request to the server-side API endpoint
   - The server generates an OpenAI text embedding using the "text-embedding-3-small" model
   - The embedding is returned to the client and saved to Supabase

3. **Storage**: The embedding is stored as a vector in the chat_messages table in Supabase.

4. **Retrieval**: In the global research chat (nodeId='0'), when a user asks a question, the system:
   - Securely generates an embedding for the question via the server API
   - Performs a vector similarity search to find related messages from other nodes
   - Displays relevant messages with context about which node they came from
   - Includes these relevant messages as context for the AI's response

5. **Visual Distinction**: Retrieved messages from other nodes are displayed with a distinctive style and include information about their source node.

## Technical Details

- The embedding function uses OpenAI's "text-embedding-3-small" model
- Embedding vectors have 1536 dimensions
- The similarity search uses cosine similarity with a customizable threshold
- The number of retrieved messages can be configured (default: 5)
- All OpenAI API calls are made securely server-side

## Troubleshooting

If you encounter issues:

1. **Check pgvector Extension**: Ensure the vector extension is properly enabled in Supabase
2. **Verify API Keys**: Make sure your OpenAI API key is valid and has permission to use the embedding model
3. **Check Server API**: Verify the server-side embedding API endpoint is working by testing:
   ```
   curl -X POST http://localhost:3000/api/embedding \
     -H "Content-Type: application/json" \
     -d '{"text":"Test embedding generation"}'
   ```
4. **Check Migration**: Verify the SQL migration was executed successfully
5. **Inspect Embedding Values**: You can check if embeddings are being properly stored with a query:
   ```sql
   SELECT id, message, embedding IS NOT NULL as has_embedding 
   FROM chat_messages 
   ORDER BY created_at DESC LIMIT 10;
   ```
6. **Browser Console Errors**: If you see browser console errors related to OpenAI, make sure you're using the server-side API and not initializing the OpenAI client in browser code.
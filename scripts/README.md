# LearnFlow Scripts

This directory contains utility scripts for the LearnFlow application.

## add_embeddings_to_perplexity_messages.py

This script adds OpenAI text embeddings to all messages in the Supabase database that currently lack embeddings. It finds all messages (both user messages and AI responses) that have NULL embeddings, generates OpenAI text embeddings for them, and updates the records to enable semantic search functionality.

### Prerequisites

- Python 3.8 or higher
- Required Python packages:
  - `openai>=1.0.0` (compatible with the new OpenAI SDK v1.0.0+)
  - `supabase`
  - `python-dotenv`

> **Important**: This script uses the new OpenAI Python SDK v1.0.0+ client-based approach. Make sure you have the latest version installed: `pip install openai --upgrade`

### Installation

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

2. Install the required packages:
   ```bash
   pip install openai>=1.0.0 supabase python-dotenv
   ```

### Configuration

The script requires the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `OPENAI_API_KEY`: Your OpenAI API key

These can be defined in a `.env` file in the root directory of the project.

### Usage

Run the script from the project root directory:

```bash
python scripts/add_embeddings_to_perplexity_messages.py
```

The script will:
1. Connect to your Supabase database
2. Find all messages with NULL embeddings (regardless of sender or message type)
3. Generate OpenAI text-embedding-3-small embeddings for each message
4. Update the message records with the new embeddings

This allows all messages to be included in semantic searches and recommendations throughout the application.

### Output

The script will output progress information as it runs:
- Number of messages found without embeddings
- Processing status for each message
- Summary of successful and failed operations

Example output:
```
Starting to process messages without embeddings...
Found 42 messages without embeddings.
Processing message 123e4567-e89b-12d3-a456-426614174000 (sender: AI, node: 123)...
Successfully updated message 123e4567-e89b-12d3-a456-426614174000 with embedding
Processing message 456e7890-e12d-34a5-b678-426614174000 (sender: USER, node: 456)...
Successfully updated message 456e7890-e12d-34a5-b678-426614174000 with embedding
...
Processing complete.
Successfully processed 41 messages.
Failed to process 1 messages.
Done!
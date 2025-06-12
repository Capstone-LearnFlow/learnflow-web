# LearnFlow Scripts

This directory contains utility scripts for the LearnFlow application.

## add_embeddings_to_perplexity_messages.py

This script finds existing Perplexity chat messages in the Supabase database that don't have embeddings, generates OpenAI embeddings for them, and updates the records.

### Prerequisites

- Python 3.8 or higher
- Required Python packages:
  - `openai`
  - `supabase`
  - `python-dotenv`

### Installation

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

2. Install the required packages:
   ```bash
   pip install openai supabase python-dotenv
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
2. Find chat messages with NULL embeddings
3. Generate OpenAI embeddings for each message
4. Update the message records with the new embeddings

### Output

The script will output progress information as it runs:
- Number of messages found without embeddings
- Processing status for each message
- Summary of successful and failed operations

Example output:
```
Starting to process messages without embeddings...
Found 42 messages without embeddings.
Processing message 123e4567-e89b-12d3-a456-426614174000...
Successfully updated message 123e4567-e89b-12d3-a456-426614174000 with embedding
...
Processing complete.
Successfully processed 41 messages.
Failed to process 1 messages.
Done!
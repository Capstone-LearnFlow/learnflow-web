import os
import sys
from openai import OpenAI
import json
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

# Load environment variables from .env file
load_dotenv()

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Check if required environment variables are set
if not SUPABASE_URL or not SUPABASE_KEY or not OPENAI_API_KEY:
    print("Error: Missing required environment variables.")
    print("Please make sure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and OPENAI_API_KEY are set.")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize OpenAI client (using v1.0.0+ client-based approach)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def generate_embedding(text: str) -> List[float]:
    """
    Generate an embedding for the given text using OpenAI's API.
    
    Args:
        text (str): The text to generate an embedding for
        
    Returns:
        List[float]: The embedding vector
    """
    try:
        # Using new OpenAI client format (v1.0.0+)
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )
        # Access data using object properties instead of dictionary keys
        embedding = response.data[0].embedding
        return embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return []

def get_messages_without_embeddings() -> List[Dict[str, Any]]:
    """
    Fetch ALL messages from Supabase that don't have embeddings.
    
    Returns:
        List[Dict[str, Any]]: List of messages without embeddings
    """
    try:
        # Query for ALL messages with NULL embedding
        # We only filter out empty messages
        response = supabase.table("chat_messages") \
            .select("id, message, sender, node_id, parent_node_id, assignment_id") \
            .is_("embedding", "null") \
            .not_.eq("message", "") \
            .order("created_at") \
            .execute()
        
        if not response.data:
            print("No messages found without embeddings.")
            return []
        
        print(f"Found {len(response.data)} messages without embeddings.")
        return response.data
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return []

def update_message_with_embedding(message_id: str, embedding: List[float]) -> bool:
    """
    Update a message in Supabase with its embedding.
    
    Args:
        message_id (str): The ID of the message to update
        embedding (List[float]): The embedding vector to add
        
    Returns:
        bool: True if update was successful, False otherwise
    """
    try:
        response = supabase.table("chat_messages") \
            .update({"embedding": embedding}) \
            .eq("id", message_id) \
            .execute()
        
        return True
    except Exception as e:
        print(f"Error updating message {message_id}: {e}")
        return False

def process_messages():
    """
    Main function to process ALL messages without embeddings.
    """
    # Get ALL messages without embeddings
    messages = get_messages_without_embeddings()
    
    if not messages:
        print("No messages to process.")
        return
    
    success_count = 0
    error_count = 0
    
    # Process each message
    for message in messages:
        message_id = message["id"]
        message_text = message["message"]
        node_id = message.get("node_id", "unknown")
        
        # Skip empty messages (although we already filtered these in the query)
        if not message_text or message_text.strip() == "":
            print(f"Skipping empty message with ID {message_id}")
            continue
            
        # Log info about the message for debugging
        print(f"Processing message {message_id} (sender: {message.get('sender', 'unknown')}, " +
              f"node: {node_id})")
        
        print(f"Processing message {message_id}...")
        
        # Generate embedding
        embedding = generate_embedding(message_text)
        
        if not embedding:
            print(f"Failed to generate embedding for message {message_id}")
            error_count += 1
            continue
        
        # Update message with embedding
        if update_message_with_embedding(message_id, embedding):
            print(f"Successfully updated message {message_id} with embedding")
            success_count += 1
        else:
            print(f"Failed to update message {message_id}")
            error_count += 1
    
    print(f"\nProcessing complete.")
    print(f"Successfully processed {success_count} messages.")
    print(f"Failed to process {error_count} messages.")

if __name__ == "__main__":
    print("Starting to process messages without embeddings...")
    process_messages()
    print("Done!")
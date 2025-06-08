import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to generate OpenAI embeddings using server-side API
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  try {
    // Call server-side API endpoint instead of directly using OpenAI client
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
};

// Types for chat logs
export interface ChatMessage {
  id?: string;
  assignment_id: string;
  parent_node_id: string;
  node_id: string;
  sender: 'USER' | 'AI';
  message: string;
  created_at?: string;
  mode: 'ask' | 'create';
  user_id?: string;       // User ID for identifying which user sent the message
  user_name?: string;     // User name for display purposes
  suggestions?: string[];
  citations?: {
    text: string;
    url: string;
    title: string;
    index?: number;
  }[];
}

// Extended ChatMessage interface to include embedding
export interface ChatMessageWithEmbedding extends ChatMessage {
  embedding?: number[];
}

// Function to save a chat message to Supabase
export const saveChatMessage = async (message: ChatMessage): Promise<{ success: boolean; error?: any }> => {
  try {
    // Generate embedding for the message
    let embedding = null;
    if (message.message.trim()) {
      embedding = await generateEmbedding(message.message);
    }
    
    const { error } = await supabase
      .from('chat_messages')
      .insert([
        {
          assignment_id: message.assignment_id,
          parent_node_id: message.parent_node_id,
          node_id: message.node_id,
          sender: message.sender,
          message: message.message,
          mode: message.mode,
          user_id: message.user_id || null,    // Include user ID in saved message
          user_name: message.user_name || null, // Include user name in saved message
          suggestions: message.suggestions || [],
          citations: message.citations || [],
          embedding: embedding,              // Add embedding to the message
        },
      ]);

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error saving chat message:', error);
    return { success: false, error };
  }
};

// Function to load chat messages from Supabase
export const loadChatMessages = async (
  assignmentId: string,
  parentNodeId: string,
  nodeId: string,
  userId?: string // Optional user ID to filter messages by user
): Promise<{ success: boolean; data?: ChatMessage[]; error?: any }> => {
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('parent_node_id', parentNodeId)
      .eq('node_id', nodeId);
      
    // If userId is provided, filter messages by that user
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    
    return { success: true, data: data as ChatMessage[] };
  } catch (error) {
    console.error('Error loading chat messages:', error);
    return { success: false, error };
  }
};

// Function to search for relevant chat messages using embedding similarity
export const searchRelevantMessages = async (
  assignmentId: string,
  messageText: string,
  limit: number = 5
): Promise<{ success: boolean; data?: ChatMessage[]; error?: any }> => {
  try {
    // Generate embedding for the query message
    const embedding = await generateEmbedding(messageText);
    
    if (!embedding) {
      console.warn('Could not generate embedding for search query. Returning empty results.');
      return { success: true, data: [] };
    }
    
    try {
      // Attempt to perform vector similarity search in Supabase
      const { data, error } = await supabase
        .rpc('match_chat_messages', {
          query_embedding: embedding,
          match_threshold: 0.5, // Adjust threshold as needed
          match_count: limit,
          p_assignment_id: assignmentId
        });
      
      if (error) {
        console.warn('Vector search RPC error (match_chat_messages might not be set up yet):', error);
        return { success: true, data: [] }; // Return empty results instead of failing
      }
      
      return { success: true, data: data as ChatMessage[] };
    } catch (rpcError) {
      // If RPC fails (function doesn't exist), log and return empty results
      console.warn('Vector search failed (pgvector might not be set up):', rpcError);
      return { success: true, data: [] }; // Return empty results instead of failing
    }
  } catch (error) {
    console.error('Error in searchRelevantMessages:', error);
    // Return success with empty data to prevent application crashes
    return { success: true, data: [], error };
  }
};

// Function to delete all chat messages for a specific node
export const deleteChatMessages = async (
  assignmentId: string,
  parentNodeId: string,
  nodeId: string
): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('assignment_id', assignmentId)
      .eq('parent_node_id', parentNodeId)
      .eq('node_id', nodeId);

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting chat messages:', error);
    return { success: false, error };
  }
};
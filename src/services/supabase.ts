import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Function to save a chat message to Supabase
export const saveChatMessage = async (message: ChatMessage): Promise<{ success: boolean; error?: any }> => {
  try {
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
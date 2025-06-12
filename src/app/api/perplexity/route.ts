import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';
import { ChatCompletionChunk } from 'openai/resources';
import { saveChatMessage, ChatMessage } from '../../../services/supabase';

// Define custom types for Perplexity API response
interface SearchResult {
  title: string;
  url: string;
  date?: string | null;
}

interface PerplexityResponse extends ChatCompletionChunk {
  citations?: string[];
  search_results?: SearchResult[];
}

// Define type for chat messages
interface PerplexityChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, assignmentId, parentNodeId, nodeId, userId, userName } = await request.json();

    // Create an encoder for streaming responses
    const encoder = new TextEncoder();
    
    // Variable to accumulate the full response for embedding
    let fullResponseText = '';
    let citationsData: any[] = [];

    // Configure Perplexity API client
    const client = new OpenAI({
      baseURL: process.env.PPLX_BASE_URL || 'https://api.perplexity.ai',
      apiKey: process.env.PPLX_API_KEY || process.env.OPENAI_API_KEY, // Use Perplexity API key first, fallback to OpenAI if needed
    });

    // Create transform stream for API responses
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Prepare contents array with history if available
          let messages: PerplexityChatMessage[] = [];

          if (history && Array.isArray(history) && history.length > 0) {
            // Convert from Gemini format to OpenAI format
            messages = history.map(item => ({
              role: item.role === 'user' ? 'user' : 'assistant',
              content: item.parts?.[0]?.text || '',
            } as PerplexityChatMessage));
          }

          // Add the new user message
          messages.push({
            role: 'user',
            content: message,
          });

          // Add system message
          messages.unshift({
            role: 'system',
            content: '중학생에게 설명하듯이 친절하고 쉽게 설명해 주세요.' +
              '답변은 한국어로 작성해 주세요.',
          });

          // Call the Perplexity API
          const streamResponse = await client.chat.completions.create({
            model: 'sonar-pro',
            messages: messages,
            stream: true,
          });

          // Process the stream
          for await (const chunk of streamResponse) {
            // Send the raw chunk as JSON for client-side processing
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            
            // Check if this chunk contains citation data (at the end of the response)
            // Cast to our custom type that includes Perplexity-specific fields
            const perplexityChunk = chunk as unknown as PerplexityResponse;
            
            // Accumulate text content for embedding
            if (perplexityChunk.choices && 
                perplexityChunk.choices[0] && 
                perplexityChunk.choices[0].delta && 
                perplexityChunk.choices[0].delta.content) {
              fullResponseText += perplexityChunk.choices[0].delta.content;
            }
            
            if (perplexityChunk.citations || perplexityChunk.search_results) {
              // Format citation data in a structure similar to what the frontend expects
              const citationData = {
                type: 'citations',
                groundingMetadata: {
                  groundingChunks: (perplexityChunk.citations || []).map((citation: string, index: number) => ({
                    web: {
                      uri: citation,
                      title: perplexityChunk.search_results && perplexityChunk.search_results[index] ? 
                        perplexityChunk.search_results[index].title : `Source ${index + 1}`
                    }
                  }))
                }
              };
              
              // Save citations for later use
              citationsData = (perplexityChunk.citations || []).map((citation: string, index: number) => ({
                text: `[${index + 1}]`,
                url: citation,
                title: perplexityChunk.search_results && perplexityChunk.search_results[index] ? 
                  perplexityChunk.search_results[index].title : `Source ${index + 1}`,
                index
              }));
              
              // Send citation data
              controller.enqueue(encoder.encode(JSON.stringify(citationData) + '\n'));
            }
          }
          
          // Save the complete response to Supabase with embedding if we have valid parameters
          if (fullResponseText && assignmentId && parentNodeId && nodeId) {
            try {
              // Save the AI message to Supabase
              await saveChatMessage({
                assignment_id: assignmentId,
                parent_node_id: parentNodeId,
                node_id: nodeId,
                sender: 'AI',
                message: fullResponseText,
                mode: 'ask',
                user_id: userId,
                user_name: userName,
                citations: citationsData,
                skip_embedding: false // Ensure embedding is generated
              });
            } catch (saveError) {
              console.error('Error saving Perplexity response to Supabase:', saveError);
              // Continue with response even if save fails
            }
          }

          controller.close();
        } catch (error) {
          console.error("Error in stream processing:", error);
          // Return an error message
          controller.enqueue(encoder.encode(JSON.stringify({
            text: "죄송합니다. 요청을 처리하는 동안 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          }) + '\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Transfer-Encoding': 'chunked'
      },
    });
  } catch (error) {
    console.error('Error in Perplexity API route:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
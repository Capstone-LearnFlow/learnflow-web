import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';
import { ChatCompletionChunk } from 'openai/resources';

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
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // Create an encoder for streaming responses
    const encoder = new TextEncoder();

    // Configure Perplexity API client (using OpenAI client with custom base URL)
    const client = new OpenAI({
      baseURL: process.env.PPLX_BASE_URL,
      apiKey: process.env.PPLX_API_KEY,
    });

    // Create transform stream for API responses
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Prepare contents array with history if available
          let messages: ChatMessage[] = [];

          if (history && Array.isArray(history) && history.length > 0) {
            // Convert from Gemini format to OpenAI format
            messages = history.map(item => ({
              role: item.role === 'user' ? 'user' : 'assistant',
              content: item.parts?.[0]?.text || '',
            } as ChatMessage));
          }

          // Add the new user message
          messages.push({
            role: 'user',
            content: message,
          });

          // Add system message
          messages.unshift({
            role: 'system',
            content: 'You are a helpful assistant.',
          });

          // Call the Perplexity API
          const streamResponse = await client.chat.completions.create({
            model: 'perplexity/sonar',
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
              
              // Send citation data
              controller.enqueue(encoder.encode(JSON.stringify(citationData) + '\n'));
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
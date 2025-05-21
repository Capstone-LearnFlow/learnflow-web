import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in environment variables' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const tools = [
      { googleSearch: {} },
    ];

    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      tools,
      responseMimeType: 'text/plain',
    };

    const model = 'gemini-2.5-flash-preview-05-20';
    
    // Prepare contents array with history if available
    let contents = [];
    
    if (history && Array.isArray(history) && history.length > 0) {
      contents = history;
    }
    
    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Create transform stream for parsing JSON chunks
    const transformStream = new TransformStream({
      start(controller) {},
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });

    // Use standard Response with ReadableStream for streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let suggestions = [];
          let lastResponse = null;

          const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
          });

          for await (const chunk of response) {
            // Store the raw JSON response for potential suggestions
            lastResponse = chunk;
            
            if (chunk.text) {
              fullResponse += chunk.text;
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'text',
                content: chunk.text
              }) + '\n'));
            }
          }

          // After all text is streamed, check if we have suggestions to send
          if (lastResponse && 
              lastResponse.candidates && 
              lastResponse.candidates[0] && 
              lastResponse.candidates[0].groundingMetadata &&
              lastResponse.candidates[0].groundingMetadata.webSearchQueries) {
            suggestions = lastResponse.candidates[0].groundingMetadata.webSearchQueries;
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'suggestions',
              content: suggestions
            }) + '\n'));
          }

          controller.close();
        } catch (error) {
          console.error("Error in Gemini API stream:", error);
          controller.error(error);
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
    console.error('Error in Gemini API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
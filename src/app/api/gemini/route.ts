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

    // Create transform stream for parsing chunks
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
          });

          // Track the accumulated full response to extract citations at the end
          let fullText = '';
          let lastChunk = null;
          let citationData = null;

          for await (const chunk of response) {
            // Send the raw chunk as JSON for client-side processing
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            
            // Store the last chunk to extract grounding metadata
            lastChunk = chunk;
            
            // Accumulate the text for full response - handle different response formats
            if (chunk.text) {
              // Direct text property (simplified format)
              fullText += chunk.text;
            } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
              // Extract text from nested candidate structure (full response format)
              const candidateContent = chunk.candidates[0].content;
              if (candidateContent.parts && candidateContent.parts[0] && candidateContent.parts[0].text) {
                fullText += candidateContent.parts[0].text;
              }
            }
          }

          // After all chunks are processed, check if we have citation data
          if (lastChunk && 
              lastChunk.candidates && 
              lastChunk.candidates[0] && 
              lastChunk.candidates[0].groundingMetadata) {
            
            // Send a special chunk with citation data
            citationData = {
              type: 'citations',
              groundingMetadata: lastChunk.candidates[0].groundingMetadata
            };
            
            controller.enqueue(encoder.encode(JSON.stringify(citationData) + '\n'));
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
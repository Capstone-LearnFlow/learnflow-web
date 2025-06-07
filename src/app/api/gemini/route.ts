import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // Create an encoder for streaming responses
    const encoder = new TextEncoder();

    // Configure Gemini API client
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

    // Create transform stream for API responses
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call the Gemini API
          const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
          });

          // Process API response
          let lastChunk = null;
          let citationData = null;

          for await (const chunk of response) {
            // Send the raw chunk as JSON for client-side processing
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));

            // Store the last chunk to extract grounding metadata
            lastChunk = chunk;
          }

          // Extract citation data if available
          if (lastChunk &&
            lastChunk.candidates &&
            lastChunk.candidates[0] &&
            lastChunk.candidates[0].groundingMetadata) {

            const groundingMetadata = lastChunk.candidates[0].groundingMetadata;
            citationData = {
              type: 'citations',
              groundingMetadata: groundingMetadata,
              segmentMapping: groundingMetadata.groundingSupports?.map(support => ({
                segment: support.segment,
                citationIndices: support.groundingChunkIndices
              })) || []
            };

            controller.enqueue(encoder.encode(JSON.stringify(citationData) + '\n'));
          }

          controller.close();
        } catch (error) {
          console.error("Error in stream processing:", error);
          // Return an error message instead of falling back to mock data
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
    console.error('Error in Gemini API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { NextRequest, NextResponse } from 'next/server';

// Citation type
interface Citation {
  text: string;
  url: string;
  title: string;
  index: number;
}

export async function POST(request: NextRequest) {
  try {
    const { text, history, systemPrompt = '' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Missing required 'text' parameter" },
        { status: 400 }
      );
    }

    // Initialize Cerebras client
    const cerebras = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY || ''
    });

    // Prepare messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
      { role: "system" as const, content: systemPrompt || '' }
    ];

    // Add history if provided
    if (history && Array.isArray(history)) {
      messages.push(...history.map((msg: string) => {
        // Extract role and content from the message format "ROLE: content"
        const parts = msg.split(': ');
        const role = parts[0].toLowerCase() === '사용자' ? 'user' as const : 'assistant' as const;
        const content = parts.slice(1).join(': ');
        return { role, content };
      }));
    }

    // Add the current user message
    messages.push({ role: "user" as const, content: text });

    // Create encoder for streaming
    const encoder = new TextEncoder();
    const customStream = new TransformStream();
    const writer = customStream.writable.getWriter();

    // Create streaming response
    const streamingResponse = new Response(customStream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

    // Process streaming in background
    (async () => {
      try {
        const stream = await cerebras.chat.completions.create({
          messages,
          model: 'qwen-3-32b',
          stream: true,
          max_completion_tokens: 16382,
          temperature: 0.7,
          top_p: 0.95
        });

        let fullText = '';
        let passedThinkTag = false;
        let citations: Citation[] = [];

        // Process stream chunks
        for await (const chunk of stream) {
          // Type assertion for chunk structure
          const content = (chunk as any).choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;

            // Check if we've passed the </think> tag - only process content after this tag
            if (!passedThinkTag) {
              const thinkTagIndex = fullText.indexOf('</think>');
              if (thinkTagIndex !== -1) {
                passedThinkTag = true;
                // Keep only the content after </think>
                fullText = fullText.substring(thinkTagIndex + '</think>'.length);

                // Send the first content after removing the think tag
                await writer.write(encoder.encode(fullText));
              }
            } else {
              // We've already passed the think tag, just send the content
              await writer.write(encoder.encode(content));
            }
          }
        }

        // Extract citations from the final text if any
        // This is a placeholder - in a real implementation, we would parse 
        // citations from the response based on the model's output format
        // For now, we'll look for URLs in the text
        const urlRegex = /https?:\/\/[^\s)]+/g;
        const urls = fullText.match(urlRegex) || [];

        if (urls.length > 0) {
          // Create citation objects with placeholder titles
          // In a real implementation, we would fetch titles or use titles provided by the model
          citations = urls.map((url, index) => ({
            text: `[${index + 1}]`,
            url,
            title: `Source ${index + 1}`,
            index
          }));

          // Send citation data in the same format as Perplexity API
          const citationData = {
            type: 'citations',
            groundingMetadata: {
              groundingChunks: citations.map(citation => ({
                web: {
                  uri: citation.url,
                  title: citation.title
                }
              }))
            }
          };

          await writer.write(encoder.encode('\n' + JSON.stringify(citationData)));
        }

        await writer.close();
      } catch (error) {
        console.error("Error in streaming Cerebras response:", error);
        const errorMessage = "Error generating streaming response";
        await writer.write(encoder.encode(errorMessage));
        await writer.close();
      }
    })();

    return streamingResponse;
  } catch (error) {
    console.error("Error calling Cerebras API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
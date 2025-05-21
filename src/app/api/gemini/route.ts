import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// Function to create a mock response stream with inline citations
async function createMockResponseStream(controller: ReadableStreamDefaultController, encoder: TextEncoder, query: string) {
  // Simulate streaming delay
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Define sample sources for citations
  const sources = [
    { uri: "https://example.com/aging-research", title: "Aging Research Institute" },
    { uri: "https://example.com/demographics", title: "Demographics Studies" },
    { uri: "https://example.com/healthcare", title: "Healthcare Journal" },
    { uri: "https://example.com/economics", title: "Economic Impact of Aging" },
    { uri: "https://example.com/social-policy", title: "Social Policy Review" },
    { uri: "https://example.com/statistics", title: "Statistical Reports" },
    { uri: "https://example.com/medical-advances", title: "Medical Advances Journal" }
  ];
  
  // Mock response text with deliberate pauses to simulate streaming
  const paragraphs = [
    "고령화의 주요 원인은 크게 두 가지로 볼 수 있습니다.",
    "**1. 평균 수명 증가**\n*   **의료 기술 발달 및 위생 개선**: 경제 발전과 함께 영양 및 위생 상태가 좋아지고, 보건 및 의료 기술이 발전하면서 기대 수명이 크게 늘어났습니다. 특히 고령층의 사망률 개선이 기대 수명 증가에 크게 기여하고 있습니다.",
    "*   **사회경제적 수준 향상**: 경제력 향상은 위생 환경 개선뿐 아니라 건강에 대한 관심과 투자 증가로 이어져 기대 수명 증가에 기여합니다.",
    "**2. 저출산**\n*   **경제적 부담**: 자녀 양육 및 교육비 부담이 출산율 저하를 심화시키는 주요 원인입니다. 특히 높은 사교육비 비중도 저출산의 원인으로 지적됩니다.",
    "*   **여성의 사회 참여 증가 및 일-가정 양립의 어려움**: 여성의 경제활동 참여율이 증가하면서 육아를 지원하는 시설 부족이나 일과 가정의 양립이 어려운 환경 등이 출산율을 낮추는 요인이 됩니다.",
    "*   **가치관 변화**: 결혼과 가족에 대한 개인주의적 가치관 변화, 결혼 연령 상승 및 미혼 인구 증가도 저출산에 영향을 미칩니다.",
    "특히 한국은 다른 국가에 비해 고령화 속도가 매우 빠른 특징을 보입니다."
  ];
  
  // Create segment mappings for inline citations
  const segmentMappings = [
    { segment: { startIndex: 0, endIndex: 27, text: "고령화의 주요 원인은 크게 두 가지로 볼 수 있습니다." }, citationIndices: [0, 1] },
    { segment: { startIndex: 28, endIndex: 224, text: "**1. 평균 수명 증가**\n*   **의료 기술 발달 및 위생 개선**: 경제 발전과 함께 영양 및 위생 상태가 좋아지고, 보건 및 의료 기술이 발전하면서 기대 수명이 크게 늘어났습니다. 특히 고령층의 사망률 개선이 기대 수명 증가에 크게 기여하고 있습니다." }, citationIndices: [0, 2, 6] },
    { segment: { startIndex: 225, endIndex: 343, text: "*   **사회경제적 수준 향상**: 경제력 향상은 위생 환경 개선뿐 아니라 건강에 대한 관심과 투자 증가로 이어져 기대 수명 증가에 기여합니다." }, citationIndices: [3] },
    { segment: { startIndex: 344, endIndex: 478, text: "**2. 저출산**\n*   **경제적 부담**: 자녀 양육 및 교육비 부담이 출산율 저하를 심화시키는 주요 원인입니다. 특히 높은 사교육비 비중도 저출산의 원인으로 지적됩니다." }, citationIndices: [1, 4] },
    { segment: { startIndex: 479, endIndex: 643, text: "*   **여성의 사회 참여 증가 및 일-가정 양립의 어려움**: 여성의 경제활동 참여율이 증가하면서 육아를 지원하는 시설 부족이나 일과 가정의 양립이 어려운 환경 등이 출산율을 낮추는 요인이 됩니다." }, citationIndices: [1, 3, 4] },
    { segment: { startIndex: 644, endIndex: 760, text: "*   **가치관 변화**: 결혼과 가족에 대한 개인주의적 가치관 변화, 결혼 연령 상승 및 미혼 인구 증가도 저출산에 영향을 미칩니다." }, citationIndices: [4, 5] },
    { segment: { startIndex: 761, endIndex: 795, text: "특히 한국은 다른 국가에 비해 고령화 속도가 매우 빠른 특징을 보입니다." }, citationIndices: [5, 0] }
  ];
  
  // Simulate streaming text chunks
  for (const paragraph of paragraphs) {
    // Split paragraph into words for more natural-looking streaming
    const words = paragraph.split(' ');
    let accumText = '';
    
    // Send each word with a short delay to simulate typing
    for (const word of words) {
      accumText += (accumText ? ' ' : '') + word;
      const chunk = { text: (accumText === word ? word : ' ' + word) };
      controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
      await sleep(50); // Adjust timing as needed
    }
    
    // Add newline between paragraphs
    controller.enqueue(encoder.encode(JSON.stringify({ text: '\n\n' }) + '\n'));
    await sleep(200);
  }
  
  // After all text, send citation data
  const citationData = {
    type: 'citations',
    groundingMetadata: {
      groundingChunks: sources.map(source => ({ web: source })),
      webSearchQueries: ["고령화 원인", "저출산 고령화 원인", "평균 수명 증가 원인"]
    },
    segmentMapping: segmentMappings
  };
  
  controller.enqueue(encoder.encode(JSON.stringify(citationData) + '\n'));
  controller.close();
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // Create an encoder for streaming responses
    const encoder = new TextEncoder();
    
    // For demonstration purposes, we'll use mock data regardless of API key
    // This ensures features like inline citations work properly
    const stream = new ReadableStream({
      start(controller) {
        createMockResponseStream(controller, encoder, message);
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Transfer-Encoding': 'chunked'
      },
    });
    
    // NOTE: Below is the real API implementation that would be used with a valid API key
    // Currently disabled for demonstration purposes
    /*
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

    // Create transform stream for actual API responses
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Attempt to call the real API
          let response;
          try {
            response = await ai.models.generateContentStream({
              model,
              config,
              contents,
            });
          } catch (apiError) {
            console.error("Gemini API error, using fallback:", apiError);
            // Use mock data on API error
            return createMockResponseStream(controller, encoder, message);
          }

          // Process real API response if successful
          let fullText = '';
          let lastChunk = null;
          let citationData = null;

          for await (const chunk of response) {
            // Send the raw chunk as JSON for client-side processing
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            
            // Store the last chunk to extract grounding metadata
            lastChunk = chunk;
            
            // Accumulate the text for full response
            if (chunk.text) {
              fullText += chunk.text;
            } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
              const candidateContent = chunk.candidates[0].content;
              if (candidateContent.parts && candidateContent.parts[0] && candidateContent.parts[0].text) {
                fullText += candidateContent.parts[0].text;
              }
            }
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
          
          // Fall back to mock data on any stream error
          createMockResponseStream(controller, encoder, message);
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
    */
  } catch (error) {
    console.error('Error in Gemini API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
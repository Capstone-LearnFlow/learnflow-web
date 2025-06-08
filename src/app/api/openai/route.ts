import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Get parameters from the request body (parse JSON only once)
    const { text, history, stream = false, model = "gpt-4.1" } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Missing required 'text' parameter" },
        { status: 400 }
      );
    }

    // Base system message
    const systemMessage = "학생이 간략하게 정리한 주장 및 근거들을 AI와의 채팅 기록을 참고하여 정교하고 상세한 내러티브로 확장하십시오.\n\n# Steps\n\n1. **주제 이해**: 학생이 제시한 주장을 파악하고, 관련된 맥락을 이해합니다.\n2. **채팅 기록 분석**: 주어진 AI와의 채팅 기록을 검토하여 학생의 주장과 근거를 강화하거나 보완할 수 있는 요소를 찾습니다.\n3. **근거 구성**: 적절하고 근거가 있는 최대 3개의 세부 근거를 개발합니다. 이때, 다양한 관점이나 자료를 활용하여 근거의 깊이를 더합니다.\n4. **논리적 흐름 구성**: 주장을 중심으로 관련된 근거들이 자연스럽고 설득력 있게 연결되도록 합니다.\n5. **재검토**: 최종 정리를 검토하여 일관성과 정확성을 유지합니다.\n\n# Output Format\n\n- **주장**: 간결하고 명료하게 주제를 요약한 주장 문장.\n- **근거**: 최대 3개의 근거를 자세히 설명하며, 각각의 근거는 새로운 문단으로 나눕니다.\n\n# Notes\n\n- 논리적 일관성을 위해 주제와 근거의 연관성을 항상 명확히 하십시오.\n- 필요한 경우, 추가적인 출처나 예시를 통해 근거를 강력하게 뒷받침하십시오.";

    // Add history to system message if provided
    const finalSystemMessage = history 
      ? `${systemMessage}\n\n채팅 기록:\n${history}` 
      : systemMessage;

    // Prepare messages array in the format OpenAI requires
    const messages = [
      { role: "system", content: finalSystemMessage },
      { role: "user", content: text }
    ];

    // If streaming is requested, handle streaming response
    if (stream) {
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
          const streamResponse = await openai.chat.completions.create({
            model: model, // Use the specified model (gpt-4.1-mini for global chat)
            messages: messages,
            stream: true,
            temperature: 0.7,
          });

          for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              await writer.write(encoder.encode(content));
            }
          }

          await writer.close();
        } catch (error) {
          console.error("Error in streaming OpenAI response:", error);
          const errorMessage = "Error generating streaming response";
          await writer.write(encoder.encode(errorMessage));
          await writer.close();
        }
      })();

      return streamingResponse;
    }

    // For non-streaming requests with assertion response format
    const response = await openai.chat.completions.create({
      model: model, // Use the specified model
      messages: messages,
      response_format: {
        "type": "json_schema",
        "json_schema": {
          "name": "assertion_with_evidence",
          "strict": true,
          "schema": {
            "type": "object",
            "properties": {
              "assertion": {
                "type": "string",
                "description": "주장을 설명하는 텍스트."
              },
              "evidences": {
                "type": "array",
                "description": "주장을 뒷받침하는 근거들.",
                "items": {
                  "type": "string",
                  "description": "주장을 지지하는 각 근거."
                }
              }
            },
            "required": [
              "assertion",
              "evidences"
            ],
            "additionalProperties": false
          }
        }
      },
      temperature: 0.5,
      max_completion_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    // Return the response
    return NextResponse.json(response.choices[0].message.content, {
      status: 200,
    });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
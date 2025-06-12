import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
    const systemMessage = "학생의 과거 채팅 기록을 참고하여 현재 질문에 의미 있는 답변을 제공하세요.\n\n# Steps\n\n1. 학생의 과거 채팅 기록을 검토합니다.\n2. 학생의 질문의 핵심을 파악합니다.\n3. 채팅 기록과 관련된 정보를 찾아 질문에 대한 답변을 구성합니다.\n4. 필요한 경우, 추가적인 관련 정보를 곁들여 답변을 완성합니다.\n\n# Output Format\n\n답변은 자연스러운 한국어 문장으로 작성하며, 학생이 이해하기 쉽게 설명합니다.";

    // Add history to system message if provided
    const finalSystemMessage = history 
      ? `${systemMessage}\n\n채팅 기록:\n${history}` 
      : systemMessage;

    // Prepare messages array in the format OpenAI requires
    const messages: ChatCompletionMessageParam[] = [
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
            model: model, // Use the specified model (gpt-4.1 for global chat)
            messages,
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
      messages,
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
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

// Initialize OpenAI client on server side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Get the text from the request body
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Missing required 'text' parameter" },
        { status: 400 }
      );
    }

    // Generate embedding using OpenAI
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    // Return the embedding
    return NextResponse.json(
      { embedding: embedding.data[0].embedding },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating embedding:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding" },
      { status: 500 }
    );
  }
}
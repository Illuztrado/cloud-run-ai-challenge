import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Multi-turn reflection & conversation endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, mode = "chat", customPrompt } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "A non-empty messages array is required." });
      }

      const ai = getGenAI();

      let systemInstruction = `You are a thoughtful, empathetic, and highly insightful reflection companion and personal journal mentor.
Your goal is to help the user reflect deeply, gain clarity on their thoughts, process emotions, notice underlying patterns, and brainstorm constructive solutions.
Maintain a warm, attentive, non-judgmental, and articulate tone.
Provide structured reflections when helpful (using clear Markdown formatting, bullet points, and gentle follow-up questions).
Always validate their feelings while offering thoughtful perspective.`;

      if (mode === "summarize") {
        systemInstruction += `\nFocus specifically on providing an organized summary of key insights, core themes, emotional patterns, and takeaways from the journal entries.`;
      } else if (mode === "brainstorm") {
        systemInstruction += `\nFocus on creative, constructive brainstorming, exploring possibilities, lateral perspectives, and concrete actionable options.`;
      } else if (mode === "reflect") {
        systemInstruction += `\nAsk 2-3 deep, gently probing reflective questions to help the user uncover deeper layers of meaning and personal growth.`;
      } else if (mode === "action_plan") {
        systemInstruction += `\nTransform the user's thoughts and challenges into a clear, realistic, and inspiring step-by-step action plan.`;
      }

      // Format messages into Gemini contents format
      const formattedContents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === "model" || m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // If custom prompt or directive is provided, append as user instruction or context
      if (customPrompt) {
        formattedContents.push({
          role: "user",
          parts: [{ text: customPrompt }],
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const responseText = response.text || "I was unable to generate a response. Please try again.";
      return res.json({ text: responseText });
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      return res.status(500).json({
        error: error.message || "Failed to generate AI response. Please check server configuration.",
      });
    }
  });

  // Session summary & metadata auto-generator
  app.post("/api/generate-summary", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const ai = getGenAI();

      const conversationText = messages
        .map((m: { role: string; content: string }) => `${m.role === "model" ? "Gemini" : "User"}: ${m.content}`)
        .join("\n\n");

      const prompt = `Analyze this personal journaling and reflection dialogue.
Return a valid JSON object strictly matching this schema (do NOT include markdown code blocks or extra text, just raw JSON):
{
  "title": "A concise, meaningful, evocative title (max 6 words)",
  "summary": "A cohesive 2-3 sentence synthesis of the user's thoughts, insights, and key takeaways.",
  "tags": ["3 to 5 short thematic tags, e.g., 'Career', 'Gratitude', 'Mindfulness'"],
  "mood": "Single word or short phrase capturing the emotional tone, e.g., 'Reflective', 'Optimistic', 'Anxious', 'Determined', 'Grounded'"
}

Dialogue:
${conversationText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const rawText = response.text || "{}";
      let parsed = {};
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (e) {
        // Fallback cleanup if model wrapped in quotes or formatting
        const clean = rawText.replace(/```json\n?|```/g, "").trim();
        parsed = JSON.parse(clean);
      }

      return res.json(parsed);
    } catch (error: any) {
      console.error("Error in /api/generate-summary:", error);
      return res.status(500).json({
        title: "Journal Reflection",
        summary: "Reflection session with Gemini.",
        tags: ["Reflection", "Journal"],
        mood: "Thoughtful",
      });
    }
  });

  // Vite development or production middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

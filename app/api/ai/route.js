import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_MODEL,
  cleanText,
  clampInt,
  cleanMessages,
  tutorSystem,
  quizSystem,
  lessonSystem,
  extractJson,
  validateQuiz,
  friendlyApiError,
} from "../../../lib/ai";

export const maxDuration = 30;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const fail = (error, status) => Response.json({ error }, { status });

// Sends the conversation to Google's Gemini API (free tier) and returns the text.
async function askAI({ system, messages, maxTokens, json = false }) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || "";
    console.error("Gemini API error", res.status, message);
    const err = new Error(friendlyApiError(res.status, message));
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }
  const text = (body.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) {
    console.error("Gemini returned no text", JSON.stringify(body.promptFeedback || body.candidates?.[0]?.finishReason || ""));
    const err = new Error("The AI couldn't answer that one. Try asking it a different way.");
    err.status = 502;
    throw err;
  }
  return text;
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) return fail("The AI isn't switched on yet. Please tell an admin.", 500);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("The server isn't fully set up yet.", 500);

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Who is asking? Verified on the server, never trusted from the browser.
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return fail("Please sign in again.", 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return fail("Please sign in again.", 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile) return fail("Your profile could not be found.", 403);
    const isStaff = profile.role === "teacher" || profile.is_admin === true;

    // 2. What do they want?
    const input = await request.json().catch(() => ({}));
    const mode = input.mode;
    if (!["tutor", "quiz", "lesson"].includes(mode)) return fail("Unknown request.", 400);
    if (mode !== "tutor" && !isStaff) return fail("That tool is for teachers only.", 403);

    let system;
    let messages;
    let maxTokens;

    if (mode === "tutor") {
      messages = cleanMessages(input.messages);
      if (!messages.length) return fail("Please type a question first.", 400);
      system = tutorSystem({
        programme: cleanText(input.programme, 60),
        subject: cleanText(input.subject, 60),
      });
      maxTokens = 2048;
    } else if (mode === "quiz") {
      const topic = cleanText(input.topic, 200);
      const notes = cleanText(input.notes, 12000);
      if (!topic && !notes) return fail("Add a topic or paste some notes first.", 400);
      const count = clampInt(input.count, 3, 15, 8);
      const difficulty = ["easy", "mixed", "hard"].includes(input.difficulty) ? input.difficulty : "mixed";
      const programme = cleanText(input.programme, 60);
      system = quizSystem();
      maxTokens = 6000;
      messages = [
        {
          role: "user",
          content:
            `Write ${count} multiple-choice questions.\n` +
            (programme ? `Programme: ${programme}.\n` : "") +
            (topic ? `Topic: ${topic}.\n` : "") +
            `Difficulty: ${difficulty}.\n` +
            (notes ? `Base the questions only on these notes:\n"""\n${notes}\n"""` : ""),
        },
      ];
    } else {
      const subject = cleanText(input.subject, 80);
      const topic = cleanText(input.topic, 200);
      if (!topic) return fail("Please enter the lesson topic.", 400);
      system = lessonSystem();
      maxTokens = 4096;
      messages = [
        {
          role: "user",
          content:
            `Draft a lesson plan.\nSubject: ${subject || "not specified"}.\nTopic: ${topic}.\n` +
            `Class: ${cleanText(input.className, 40) || "SHS 1"}.\n` +
            `Duration: ${clampInt(input.duration, 20, 120, 60)} minutes.\n` +
            (input.extras ? `Extra requests: ${cleanText(input.extras, 800)}` : ""),
        },
      ];
    }

    // 3. Daily limit per person, so the AI bill can't run away.
    const limit = Number(isStaff ? process.env.AI_DAILY_LIMIT_STAFF || 40 : process.env.AI_DAILY_LIMIT_STUDENT || 15);
    const day = new Date().toISOString().slice(0, 10);
    const { data: usage, error: usageErr } = await admin
      .from("ai_usage")
      .select("count")
      .eq("user_id", profile.id)
      .eq("day", day)
      .maybeSingle();
    if (usageErr) {
      console.error("ai_usage error", usageErr.message);
      return fail("The AI usage tracker isn't set up yet. Please tell an admin.", 500);
    }
    const used = usage?.count || 0;
    if (used >= limit) return fail(`You've reached today's limit of ${limit} AI requests. Please try again tomorrow.`, 429);
    await admin.from("ai_usage").upsert({ user_id: profile.id, day, count: used + 1 }, { onConflict: "user_id,day" });
    const remaining = limit - used - 1;

    // 4. Ask the AI. If it fails, give the request back.
    let text;
    try {
      text = await askAI({ system, messages, maxTokens, json: mode === "quiz" });
    } catch (err) {
      await admin.from("ai_usage").upsert({ user_id: profile.id, day, count: used }, { onConflict: "user_id,day" });
      return fail(err.message, err.status || 502);
    }

    if (mode === "quiz") {
      const quiz = validateQuiz(extractJson(text));
      if (!quiz) {
        await admin.from("ai_usage").upsert({ user_id: profile.id, day, count: used }, { onConflict: "user_id,day" });
        return fail("The AI's quiz came back in a shape I couldn't use. Please try again.", 502);
      }
      return Response.json({ quiz, remaining });
    }

    return Response.json({ text, remaining });
  } catch (err) {
    console.error("AI route error", err);
    return fail("Something went wrong. Please try again.", 500);
  }
}

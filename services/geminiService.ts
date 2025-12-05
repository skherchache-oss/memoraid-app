// services/geminiService.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { CognitiveCapsule, QuizQuestion, FlashcardContent, CoachingMode, UserProfile, SourceType } from '../types';
import type { Language } from '../i18n/translations';

// ⚠️ Vérifie que l'exécution est côté client
if (typeof window === "undefined") {
  throw new Error("geminiService.ts ne doit pas être exécuté côté serveur !");
}

// --- Configuration API ---
const API_KEY = import.meta.env.VITE_GOOGLE_GENAI_API_KEY;
if (!API_KEY) throw new Error("VITE_GOOGLE_GENAI_API_KEY environment variable not set");

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helpers ---
const getLangName = (lang: Language) => lang === 'fr' ? 'FRANÇAIS' : 'ENGLISH';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanJsonResponse = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json/gi,'').replace(/```/g,'');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if(firstBrace!==-1 && lastBrace!==-1 && lastBrace>firstBrace) cleaned = cleaned.substring(firstBrace,lastBrace+1);
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if(firstBracket!==-1 && lastBracket!==-1 && lastBracket>firstBracket) cleaned = cleaned.substring(firstBracket,lastBracket+1);
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/mg,'').replace(/,(\s*[}\]])/g,'$1');
  return cleaned.trim();
};

// --- Schemas ---
const flashcardSchema = (lang: Language) => ({
  type: Type.ARRAY,
  description: `List of 5 to 8 flashcards (front/back) in ${getLangName(lang)}`,
  items: {
    type: Type.OBJECT,
    properties: {
      front: { type: Type.STRING },
      back: { type: Type.STRING }
    },
    required: ['front','back']
  }
});

const capsuleSchema = (lang: Language) => ({
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    keyConcepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { concept: { type: Type.STRING }, explanation: { type: Type.STRING } },
        required: ['concept','explanation']
      }
    },
    examples: { type: Type.ARRAY, items: { type: Type.STRING } },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ['question','options','correctAnswer','explanation']
      }
    },
    flashcards: flashcardSchema(lang),
    sourceType: { type: Type.STRING }
  },
  required: ['title','summary','keyConcepts','examples','quiz','flashcards']
});

// --- Prompt strategy ---
const getPromptStrategy = (sourceType: SourceType, lang: Language='fr') => {
  const targetLang = getLangName(lang);
  switch(sourceType){
    case 'web': return `LANGUAGE: Output MUST be in **${targetLang}**. WEB ANALYSIS.`;
    case 'pdf': return `LANGUAGE: Output MUST be in **${targetLang}**. DOCUMENT ANALYSIS.`;
    case 'image':
    case 'ocr': return `LANGUAGE: Output MUST be in **${targetLang}**. OCR TASK.`;
    case 'speech': return `LANGUAGE: Output MUST be in **${targetLang}**. SPEECH TRANSCRIPTION.`;
    case 'presentation': return `LANGUAGE: Output MUST be in **${targetLang}**. SLIDES ANALYSIS.`;
    default: return `LANGUAGE: Output MUST be in **${targetLang}**. TEXT ANALYSIS.`;
  }
};

// --- Génération avec fallback ---
const generateContentWithFallback = async (modelName: string, contents: any, schema: any, sourceType: SourceType, maxRetries = 3) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const config: any = { responseMimeType: "application/json" };
      if(attempt===0) config.responseSchema = schema;
      const response = await ai.models.generateContent({model: modelName, contents, config});
      const cleanedText = cleanJsonResponse(response.text || '');
      return JSON.parse(cleanedText);
    } catch(err: any) {
      lastError = err;
      if(attempt<maxRetries-1) await delay(1000*(attempt+1));
    }
  }
  throw lastError;
};

// --- Fonctions principales ---
export const generateCognitiveCapsule = async (inputText: string, explicitSourceType?: SourceType, language: Language='fr') => {
  const sourceType: SourceType = explicitSourceType || (/^(http|https):\/\/[^ "]+$/.test(inputText.trim()) ? 'web' : 'text');
  const strategy = getPromptStrategy(sourceType, language);
  const targetLang = getLangName(language);
  const prompt = `
    Role: Educational Expert.
    Task: Create a Cognitive Capsule in JSON from input.
    ${strategy}
    USER INPUT: "${inputText}"
    STRICT OUTPUT FORMAT: RAW JSON.
    Required: title, summary, keyConcepts, examples, quiz, flashcards
    Output in ${targetLang}.
  `;
  try {
    return await generateContentWithFallback("gemini-2.5-flash",{parts:[{text:prompt}]}, capsuleSchema(language), sourceType);
  } catch(err) {
    console.error("Error generating cognitive capsule:", err);
    throw new Error("Impossible de générer la capsule. Vérifie la clé API ou la connexion.");
  }
};

export const generateCognitiveCapsuleFromFile = async (file: File, language: Language = 'fr') => {
  const text = await file.text();
  return generateCognitiveCapsule(text, 'text', language);
};

export const createCoachingSession = async (userProfile: UserProfile, mode: CoachingMode, language: Language='fr') => {
  const targetLang = getLangName(language);
  const prompt = `Create a coaching session for ${userProfile.name} in mode ${mode}. Output in ${targetLang}. RAW JSON.`;
  const schema = {
    type: Type.OBJECT,
    properties: {
      sessionId: { type: Type.STRING },
      startTime: { type: Type.STRING },
      instructions: { type: Type.STRING }
    },
    required: ['sessionId','startTime','instructions']
  };
  try {
    return await generateContentWithFallback("gemini-2.5-flash",{parts:[{text:prompt}]}, schema, 'text');
  } catch(err) {
    console.error("Error creating coaching session:", err);
    throw new Error("Impossible de créer la session de coaching.");
  }
};

export const regenerateQuiz = async (capsule: CognitiveCapsule, language: Language='fr'): Promise<QuizQuestion[]> => {
  const targetLang = getLangName(language);
  const prompt = `Topic: "${capsule.title}". Generate 3 new quiz questions in ${targetLang}. RAW JSON ARRAY.`;
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING },
        explanation: { type: Type.STRING }
      },
      required: ['question','options','correctAnswer','explanation']
    }
  };
  try {
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType:"application/json", responseSchema: schema }});
    return JSON.parse(cleanJsonResponse(response.text||''));
  } catch(e) {
    console.warn("Regenerate quiz failed", e);
    return [];
  }
};

export const expandKeyConcept = async (title: string, concept: string, context: string, language: Language='fr'): Promise<string> => {
  const targetLang = getLangName(language);
  const prompt = `Topic: "${title}". Concept: "${concept}". Explain deeper in ${targetLang}. 3 sentences max.`;
  try {
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    return response.text || "Pas d'explication disponible.";
  } catch(e) {
    console.error("Expand key concept failed", e);
    return "Pas d'explication disponible.";
  }
};

export const generateMemoryAidDrawing = async (capsule: Pick<CognitiveCapsule,'title'|'summary'|'keyConcepts'>, language: Language='fr') => {
  const targetLang = getLangName(language);
  const prompt = `
    Topic: "${capsule.title}"
    Task: Create a BEAUTIFUL HAND-DRAWN SKETCHNOTE summary in ${targetLang}.
  `;
  try {
    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts:[{ text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] }
    });
    const part = imageResponse.candidates?.[0]?.content?.parts?.[0];
    const imageData = part?.inlineData?.data || '';
    return { imageData, description: `Sketchnote for ${capsule.title}` };
  } catch(e) {
    console.error("Memory aid drawing failed", e);
    throw new Error("Impossible de générer le dessin.");
  }
};

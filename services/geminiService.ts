
import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import type { CognitiveCapsule, QuizQuestion, FlashcardContent, CoachingMode, UserProfile, SourceType } from '../types';
import type { Language } from '../i18n/translations';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper pour obtenir le nom de la langue en toutes lettres pour le prompt
const getLangName = (lang: Language) => lang === 'fr' ? 'FRANÇAIS' : 'ENGLISH';

const flashcardSchema = (lang: Language) => ({
    type: Type.ARRAY,
    description: `List of 5 to 8 flashcards (front/back). Language: ${getLangName(lang)}.`,
    items: {
        type: Type.OBJECT,
        properties: {
            front: { type: Type.STRING, description: `Front of the card (question/term). In ${getLangName(lang)}.` },
            back: { type: Type.STRING, description: `Back of the card (answer/definition). In ${getLangName(lang)}.` },
        },
        required: ['front', 'back']
    }
});

const capsuleSchema = (lang: Language) => ({
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: `Concise title in ${getLangName(lang)}.`
    },
    summary: {
      type: Type.STRING,
      description: `Summary of 2-3 sentences in ${getLangName(lang)}.`
    },
    keyConcepts: {
      type: Type.ARRAY,
      description: `List of at least 3 key concepts in ${getLangName(lang)}.`,
      items: {
        type: Type.OBJECT,
        properties: {
            concept: { type: Type.STRING, description: `Name of the concept in ${getLangName(lang)}.` },
            explanation: { type: Type.STRING, description: `Simple explanation in ${getLangName(lang)}.` },
        },
        required: ['concept', 'explanation']
    }
    },
    examples: {
      type: Type.ARRAY,
      description: `List of concrete examples in ${getLangName(lang)}.`,
      items: {
        type: Type.STRING
      }
    },
    quiz: {
      type: Type.ARRAY,
      description: `Mini-quiz of 3 questions in ${getLangName(lang)}.`,
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: `The question in ${getLangName(lang)}.`
          },
          options: {
            type: Type.ARRAY,
            description: `List of 4 options in ${getLangName(lang)}.`,
            items: {
              type: Type.STRING
            }
          },
          correctAnswer: {
            type: Type.STRING,
            description: `The correct answer in ${getLangName(lang)}.`
          },
          explanation: {
            type: Type.STRING,
            description: `Explanation of the answer in ${getLangName(lang)}.`
          }
        },
        required: ['question', 'options', 'correctAnswer', 'explanation']
      }
    },
    flashcards: flashcardSchema(lang),
    sourceType: { type: Type.STRING, description: "Detected source type (pdf, web, image, text, speech)" }
  },
  required: ['title', 'summary', 'keyConcepts', 'examples', 'quiz', 'flashcards']
});

// NETTOYAGE JSON ROBUSTE
const cleanJsonResponse = (text: string): string => {
  if (!text) return "{}";
  
  // 1. Enlever les balises Markdown
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '');
  
  // 2. Trouver le premier '{' et le dernier '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    // Fallback: si l'IA renvoie un tableau directement
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  }

  // 3. Nettoyer les caractères invisibles et commentaires JS
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // Block comments
  cleaned = cleaned.replace(/^\s*\/\/.*$/mg, ''); // Line comments
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); // Trailing commas
  
  return cleaned.trim();
};

// RÉPARATION DES DONNÉES MANQUANTES
const repairCapsuleData = (data: any, sourceType: SourceType): any => {
    if (!data || typeof data !== 'object') return null;
    
    // Robust Key Concept fixing
    let fixedConcepts = [];
    const rawConcepts = data.keyConcepts || data.key_concepts || [];
    if (Array.isArray(rawConcepts)) {
        fixedConcepts = rawConcepts.map((item: any) => {
            if (typeof item === 'string') {
                return { concept: item, explanation: "" };
            }
            if (typeof item === 'object' && item !== null) {
                return {
                    concept: item.concept || item.title || item.name || "Concept",
                    explanation: item.explanation || item.description || item.content || "..."
                };
            }
            return null;
        }).filter((i: any) => i !== null);
    }

    return {
        title: data.title || "Sans Titre",
        summary: data.summary || "Résumé non disponible.",
        keyConcepts: fixedConcepts,
        examples: Array.isArray(data.examples) ? data.examples.filter((e: any) => typeof e === 'string') : [],
        quiz: Array.isArray(data.quiz) ? data.quiz : [],
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
        sourceType: sourceType
    };
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getPromptStrategy = (sourceType: SourceType, lang: Language = 'fr'): string => {
    const targetLang = getLangName(lang);
    const base = `LANGUAGE: Output MUST be in **${targetLang}**.`;
    
    switch (sourceType) {
        case 'web':
            return `${base} WEB ANALYSIS. Ignore navigation/ads. Focus on main article content.`;
        case 'pdf':
            return `${base} DOCUMENT ANALYSIS. Extract structure (titles) and core concepts. Ignore page numbers.`;
        case 'image':
        case 'ocr':
            return `${base} OCR TASK. Transcribe visible text, then structure it into a course. Interpret diagrams if any.`;
        case 'speech':
            return `${base} SPEECH TRANSCRIPTION. Clean oral hesitations ("euh", "um"). Rephrase into clear written academic language.`;
        case 'presentation':
            return `${base} SLIDES ANALYSIS. Link slide titles to bullet points to form coherent concepts.`;
        default: 
            return `${base} TEXT ANALYSIS. Structure the provided text.`;
    }
};

const generateContentWithFallback = async (
    modelName: string,
    contents: any,
    schema: any,
    sourceType: SourceType,
    maxRetries = 3
): Promise<any> => {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const config: any = {
                responseMimeType: "application/json",
            };

            if (attempt === 0) {
                config.responseSchema = schema;
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: contents,
                config: config
            });

            const cleanedText = cleanJsonResponse(response.text || '');
            const parsedData = JSON.parse(cleanedText);
            const repairedData = repairCapsuleData(parsedData, sourceType);

            if (repairedData.keyConcepts.length === 0 && repairedData.summary === "Résumé non disponible.") {
                throw new Error("Empty content generated");
            }

            return repairedData;

        } catch (error: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, error);
            lastError = error;
            if (attempt < maxRetries - 1) {
                await delay(1000 * (attempt + 1));
            }
        }
    }
    throw lastError;
};


export const generateCognitiveCapsule = async (inputText: string, explicitSourceType?: SourceType, language: Language = 'fr'): Promise<Omit<CognitiveCapsule, 'id' | 'createdAt' | 'lastReviewed' | 'reviewStage'>> => {
  let sourceType: SourceType = 'text';
  if (explicitSourceType) {
      sourceType = explicitSourceType;
  } else {
      const isUrl = /^(http|https):\/\/[^ "]+$/.test(inputText.trim());
      sourceType = isUrl ? 'web' : 'text';
  }
  const strategy = getPromptStrategy(sourceType, language);
  const targetLang = getLangName(language);

  const prompt = `
    Role: Educational Expert.
    Task: Create a "Cognitive Capsule" (JSON) from the user input.
    ${strategy}
    USER INPUT: "${inputText}"
    STRICT OUTPUT FORMAT: Return ONLY a raw JSON object.
    Required fields: 
    - title (string)
    - summary (string)
    - keyConcepts (array of objects {concept, explanation})
    - examples (array of strings)
    - quiz (array of objects)
    - flashcards (array of objects)
    IMPORTANT: If input is short, EXTRAPOLATE using general knowledge. Output in ${targetLang}.
  `;

  try {
      const data = await generateContentWithFallback(
          "gemini-2.5-flash",
          { parts: [{ text: prompt }] },
          capsuleSchema(language),
          sourceType
      );
      return data;
  } catch (error) {
      console.error("Error generating cognitive capsule:", error);
      throw handleGeminiError(error);
  }
};

export const generateCognitiveCapsuleFromFile = async (fileData: { mimeType: string, data: string }, explicitSourceType?: SourceType, language: Language = 'fr'): Promise<Omit<CognitiveCapsule, 'id' | 'createdAt' | 'lastReviewed' | 'reviewStage'>> => {
  let sourceType: SourceType = 'unknown';
  if (explicitSourceType) {
      sourceType = explicitSourceType;
  } else {
      if (fileData.mimeType.includes('pdf')) sourceType = 'pdf';
      else if (fileData.mimeType.includes('image')) sourceType = 'image';
      else if (fileData.mimeType.includes('presentation') || fileData.mimeType.includes('powerpoint')) sourceType = 'presentation';
      else sourceType = 'text';
  }
  const strategy = getPromptStrategy(sourceType, language);
  const targetLang = getLangName(language);

  const prompt = `
    Analyze this document/image and generate a "Cognitive Capsule" in JSON.
    ${strategy}
    CRITICAL RULES:
    1. OUTPUT LANGUAGE: **${targetLang}**.
    2. If document looks empty, EXTRAPOLATE based on title.
    3. Structure: title, summary, keyConcepts, examples, quiz, flashcards.
    4. Return RAW JSON.
  `;

  try {
      const data = await generateContentWithFallback(
          "gemini-2.5-flash",
          { parts: [
              { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }, 
              { text: prompt }
          ]},
          capsuleSchema(language),
          sourceType
      );
      return data;
  } catch (error) {
      console.error("Error generating from file:", error);
      throw handleGeminiError(error, "Impossible de générer la capsule à partir du fichier.");
  }
};

const handleGeminiError = (error: any, defaultMsg: string = "Impossible de générer la capsule.") => {
    let errorMessage = defaultMsg;
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("json")) errorMessage = "L'IA a généré un format invalide.";
        else if (msg.includes("safety") || msg.includes("blocked")) errorMessage = "Contenu bloqué par les filtres.";
        else if (msg.includes("500") || msg.includes("rpc") || msg.includes("fetch")) errorMessage = "Erreur de connexion. Réessayez.";
        else if (msg.includes("429")) errorMessage = "Service surchargé.";
    }
    return new Error(errorMessage);
};

export const createCoachingSession = (capsule: CognitiveCapsule, mode: CoachingMode = 'standard', userProfile?: UserProfile, language: Language = 'fr'): Chat => {
    const targetLang = getLangName(language);
    let systemInstruction = `
        You are Memoraid, an intelligent learning coach.
        Topic: "${capsule.title}".
        Concepts: ${capsule.keyConcepts.map(c => c.concept).join(', ')}.
        Mode: ${mode}.
        GENERAL RULE: ANSWERS MUST BE IN ${targetLang}.
    `;
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
    });
}

// FIX: Improved Memory Aid Generation with STRICT text enforcement and Professional Sketchnote style
export const generateMemoryAidDrawing = async (capsule: Pick<CognitiveCapsule, 'title' | 'summary' | 'keyConcepts'>, language: Language = 'fr'): Promise<{ imageData: string, description: string }> => {
    const targetLang = getLangName(language);
    
    // 1. Generate text description first with explicit keyword selection AND visual metaphor suggestions
    const designPrompt = `
    Topic: "${capsule.title}"
    Task: Design a BEAUTIFUL HAND-DRAWN SKETCHNOTE summary.
    Target Language: ${targetLang}.

    Step 1: Select 3 to 5 main keywords from the concept.
    Step 2: SPELLING CHECK: Verify that every selected keyword is spelled correctly in ${targetLang}. This is CRITICAL.
    Step 3: For each keyword, invent a specific visual metaphor or doodle (e.g., "Lightbulb" for idea, "Shield" for defense, "Tree" for growth).
    Step 4: Combine these into a scene description.

    Output Format:
    EXPLANATION: [A short sentence in ${targetLang} explaining the visual]
    LABELS: [The list of selected keywords in ${targetLang}, comma separated.]
    METAPHORS: [List of the doodles/icons chosen]
    PROMPT: [A detailed English prompt describing the visual.]
    `;

    try {
        const textResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: designPrompt,
        });
        
        const rawText = textResponse.text || '';
        
        // Extract parts
        const explMatch = rawText.match(/EXPLANATION:\s*(.+)/i);
        const labelsMatch = rawText.match(/LABELS:\s*(.+)/i);
        const metaphorsMatch = rawText.match(/METAPHORS:\s*(.+)/i);
        const promptMatch = rawText.match(/PROMPT:\s*(.+)/i);
        
        const explanation = explMatch ? explMatch[1].trim() : "Visualisation du concept.";
        const labels = labelsMatch ? labelsMatch[1].trim() : "";
        const metaphors = metaphorsMatch ? metaphorsMatch[1].trim() : "doodles and icons";
        const baseImagePrompt = promptMatch ? promptMatch[1].trim() : `A professional infographic about ${capsule.title}`;

        // Enforce the text labels in the final prompt with PROFESSIONAL SKETCHNOTE style + ILLUSTRATIONS
        const optimizedImagePrompt = `${baseImagePrompt}. 
        Style: Beautiful Hand-Drawn Sketchnote / Graphic Facilitation.
        Appearance: Artistic ink lines, marker coloring (Emerald Green, Amber, Navy), on clean white paper.
        Content: Central topic "${capsule.title}" surrounded by the keywords.
        Visuals: Draw specific cute doodles for each concept: ${metaphors}.
        Text Requirement: WRITE EXACTLY THESE WORDS: ${labels}.
        Constraint: NO TYPOS. PERFECT SPELLING in ${targetLang}. Text must be horizontal and legible.
        Vibe: Inspiring, educational, simple, clean, aesthetic.`;

        // 2. Generate Image
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: optimizedImagePrompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });

        let imageBase64 = '';
        for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                imageBase64 = part.inlineData.data;
                break;
            }
        }

        if (!imageBase64) throw new Error("No image generated.");

        return {
            imageData: imageBase64,
            description: explanation
        };

    } catch (error) {
        console.error("Error generating drawing:", error);
        throw new Error("Impossible de générer le dessin.");
    }
};

export const expandKeyConcept = async (title: string, concept: string, context: string, language: Language = 'fr'): Promise<string> => {
    const targetLang = getLangName(language);
    const prompt = `Topic: "${title}". Concept: "${concept}". Explain deeper in ${targetLang}. 3 sentences max.`;
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    return response.text || "Pas d'explication disponible.";
};

export const regenerateQuiz = async (capsule: CognitiveCapsule, language: Language = 'fr'): Promise<QuizQuestion[]> => {
    const targetLang = getLangName(language);
    const prompt = `Topic: "${capsule.title}". Generate 3 new quiz questions in ${targetLang}. Format: RAW JSON Array.`;
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
            required: ['question', 'options', 'correctAnswer', 'explanation']
        }
    };
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        return JSON.parse(cleanJsonResponse(response.text || ''));
    } catch (e) {
        return [];
    }
};

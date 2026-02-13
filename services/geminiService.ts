import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });


export const analyzeResume = async (resumeText: string, jobDescription: string): Promise<AnalysisResult> => {
  const prompt = `
    Act as a senior HR manager and ATS expert. Analyze the following resume against the provided job description.
    
    IMPORTANT: The resume text provided below is extracted from a document and may contain "parsing noise" such as:
    - Unexpected spaces between letters (e.g., "S o f t w a r e")
    - Broken words due to line wraps (e.g., "identi- fication")
    - Extra whitespace or missing line breaks.
    
    YOUR FIRST TASK: Mentally normalize and clean the text. Do NOT flag parsing artifacts as spelling or grammar errors. Only flag ACTUAL typos made by the candidate.

    Resume Text:
    ${resumeText}
    
    Job Description:
    ${jobDescription}
    
    Specifically audit for and IDENTIFY exact words/sections that are problematic:
    1. Typography: Are standard fonts used? (Focus on professional style).
    2. Grammar/Spelling: Point out specific REAL misspelled words or grammatical errors.
    3. Repetition: Highlight specific overused words or phrases.
    4. Layout: Identify complex elements like tables, images, or columns that reduce parsing fidelity.
    5. Headings: Check if standard headings are used correctly.

    For every "fail" or "warning" status, you MUST provide details in this exact expanded format: 
    "[Exact Word or Section Name] | [Explain Why it is wrong/ineffective] | [Provide the direct replacement/fix] | [Suggest an alternative approach or synonym]"

    Example: "Utilized | Overused buzzword | Spearheaded | Managed, Orchestrated, or Led"

    Provide a detailed ATS analysis in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          formattingScore: { type: Type.INTEGER },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          audit: {
            type: Type.OBJECT,
            properties: {
              typography: { 
                type: Type.OBJECT, 
                properties: { 
                  status: { type: Type.STRING }, 
                  message: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
              },
              grammarSpelling: { 
                type: Type.OBJECT, 
                properties: { 
                  status: { type: Type.STRING }, 
                  message: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
              },
              repetition: { 
                type: Type.OBJECT, 
                properties: { 
                  status: { type: Type.STRING }, 
                  message: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
              },
              layoutComplexity: { 
                type: Type.OBJECT, 
                properties: { 
                  status: { type: Type.STRING }, 
                  message: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
              },
              sectionHeadings: { 
                type: Type.OBJECT, 
                properties: { 
                  status: { type: Type.STRING }, 
                  message: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
              }
            },
            required: ['typography', 'grammarSpelling', 'repetition', 'layoutComplexity', 'sectionHeadings']
          }
        },
        required: ['score', 'summary', 'strengths', 'weaknesses', 'missingKeywords', 'matchedKeywords', 'formattingScore', 'recommendations', 'audit']
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return data as AnalysisResult;
  } catch (error) {
    throw new Error("Failed to parse analysis result.");
  }
};

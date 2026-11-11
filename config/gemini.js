const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Um único lugar para trocar o modelo (variável GEMINI_MODEL no .env/Render).
const MODELO_GEMINI = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// Telemetria: lê o total de tokens da resposta do Gemini.
// Aceita o objeto "result" devolvido por model.generateContent().
function contarTokens(result) {
  return (result.response.usageMetadata && result.response.usageMetadata.totalTokenCount) || 0;
}

module.exports = { genAI, MODELO_GEMINI, contarTokens };

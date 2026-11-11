// ========================================================================
// Chat com Gemini: memória, imagem, function calling (clima) e RAG.
// Sprint 8: toda chamada ao Gemini tem seus tokens contados e salvos em
// Mensagem.tokensGastos, e o gasto é transmitido em tempo real aos admins.
// ========================================================================
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { SchemaType } = require("@google/generative-ai");
const cloudinary = require("cloudinary").v2;

const Mensagem = require("../models/Mensagem");
const DocumentoRAG = require("../models/DocumentoRAG");
const { genAI, MODELO_GEMINI } = require("../config/gemini");

// Telemetria: lê result.response.usageMetadata.totalTokenCount da resposta do Gemini.
function lerTokens(result) {
  return (result.response.usageMetadata && result.response.usageMetadata.totalTokenCount) || 0;
}

// Desafio Hacker: avisa o Dashboard (só a sala "admins") que houve gasto.
function avisarGastoDeToken(req, quantidade) {
  const io = req.app.get("io");
  if (io && quantidade > 0) io.to("admins").emit("novoGastoDeToken", quantidade);
}

// ------------------------------------------------------------------------
// Histórico (o bot da sala pública fica fora do histórico privado)
// ------------------------------------------------------------------------
async function listarHistorico(req, res) {
  try {
    const historico = await Mensagem.find({ userId: req.usuario.id, origem: { $ne: "sala" } }).sort({ criadoEm: 1 });
    return res.json(historico);
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao buscar histórico." });
  }
}

async function apagarHistorico(req, res) {
  try {
    await Mensagem.deleteMany({ userId: req.usuario.id, origem: { $ne: "sala" } });
    return res.json({ mensagem: "Histórico apagado com sucesso." });
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao apagar histórico." });
  }
}

// ------------------------------------------------------------------------
// Upload de imagem (Cloudinary)
// ------------------------------------------------------------------------
async function uploadImagem(req, res) {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhuma imagem enviada." });

    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "checkup-cloud" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });
    return res.json({ url: resultado.secure_url });
  } catch (err) {
    console.error("[Upload] Erro:", err.message);
    return res.status(500).json({ erro: "Erro ao enviar imagem para o Cloudinary." });
  }
}

// ------------------------------------------------------------------------
// Function Calling - clima (Open-Meteo)
// ------------------------------------------------------------------------
async function getWeather(cidade) {
  try {
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`
    );
    const geoData = await geoResp.json();
    if (!geoData.results || geoData.results.length === 0) {
      return { erro: `Não encontrei a cidade "${cidade}".` };
    }
    const { latitude, longitude, name } = geoData.results[0];
    const climaResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    );
    const climaData = await climaResp.json();
    return {
      cidade: name,
      temperatura: `${climaData.current_weather.temperature}°C`,
      vento: `${climaData.current_weather.windspeed} km/h`,
    };
  } catch (err) {
    return { erro: "Não consegui consultar a previsão do tempo agora." };
  }
}

const weatherFunctionDeclaration = {
  name: "getWeather",
  description: "Retorna a temperatura atual e o vento de uma cidade informada.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      cidade: { type: SchemaType.STRING, description: "Nome da cidade, ex: \u0027Tóquio\u0027 ou \u0027São Paulo\u0027." },
    },
    required: ["cidade"],
  },
};

// ------------------------------------------------------------------------
// POST /api/chat
// ------------------------------------------------------------------------
async function conversar(req, res) {
  try {
    const { mensagem, imageUrl } = req.body;
    if (!mensagem) return res.status(400).json({ erro: "Mensagem vazia." });

    await Mensagem.create({
      userId: req.usuario.id,
      role: "user",
      text: mensagem,
      imageUrl: imageUrl || null,
      origem: "chat",
    });

    const historico = await Mensagem.find({ userId: req.usuario.id, origem: { $ne: "sala" } })
      .sort({ criadoEm: -1 })
      .limit(20);
    historico.reverse();

    const model = genAI.getGenerativeModel({
      model: MODELO_GEMINI,
      tools: [{ functionDeclarations: [weatherFunctionDeclaration] }],
    });

    const contents = historico.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

    if (imageUrl) {
      const imgResp = await fetch(imageUrl);
      const imgBuffer = await imgResp.buffer();
      contents[contents.length - 1].parts.push({
        inlineData: { mimeType: "image/jpeg", data: imgBuffer.toString("base64") },
      });
    }

    let result = await model.generateContent({ contents });
    let tokensTotal = lerTokens(result); // [REQ-004] result.response.usageMetadata.totalTokenCount
    let response = result.response;

    const funcCall = response.functionCalls && response.functionCalls()[0];
    let textoFinal;

    if (funcCall && funcCall.name === "getWeather") {
      const dadosClima = await getWeather(funcCall.args.cidade);
      result = await model.generateContent({
        contents: [
          ...contents,
          { role: "model", parts: [{ functionCall: funcCall }] },
          { role: "function", parts: [{ functionResponse: { name: "getWeather", response: dadosClima } }] },
        ],
      });
      tokensTotal += lerTokens(result); // a 2ª chamada também custa tokens
      textoFinal = result.response.text();
    } else {
      textoFinal = response.text();
    }

    await Mensagem.create({
      userId: req.usuario.id,
      role: "model",
      text: textoFinal,
      origem: "chat",
      tokensGastos: tokensTotal,
    });
    avisarGastoDeToken(req, tokensTotal);

    return res.json({ resposta: textoFinal });
  } catch (err) {
    console.error("[Chat] Erro:", err.message);
    return res.status(500).json({ erro: "Erro ao processar a mensagem." });
  }
}

// ------------------------------------------------------------------------
// RAG - POST/GET/DELETE /api/chat/documento
// ------------------------------------------------------------------------
const LIMITE_CARACTERES_DOCUMENTO = 15000;

async function conversarComDocumento(req, res) {
  try {
    const { pergunta } = req.body;
    if (!pergunta) return res.status(400).json({ erro: "Envie uma pergunta." });

    let textoDocumento;
    let nomeArquivo;

    if (req.file) {
      const nome = req.file.originalname.toLowerCase();
      if (nome.endsWith(".pdf")) {
        textoDocumento = (await pdfParse(req.file.buffer)).text;
      } else if (nome.endsWith(".txt")) {
        textoDocumento = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ erro: "Envie um arquivo .pdf ou .txt." });
      }
      textoDocumento = textoDocumento.trim().slice(0, LIMITE_CARACTERES_DOCUMENTO);
      nomeArquivo = req.file.originalname;

      await DocumentoRAG.findOneAndUpdate(
        { userId: req.usuario.id },
        { nomeArquivo, texto: textoDocumento, atualizadoEm: new Date() },
        { upsert: true }
      );
    } else {
      const salvo = await DocumentoRAG.findOne({ userId: req.usuario.id });
      if (!salvo) {
        return res.status(400).json({ erro: "Nenhum documento enviado ainda. Anexe um PDF ou TXT primeiro." });
      }
      textoDocumento = salvo.texto;
      nomeArquivo = salvo.nomeArquivo;
    }

    const promptRAG = `Você é um analista de dados corporativo extremamente preciso.
Abaixo está um documento de referência. Responda à pergunta do usuário baseando-se APENAS no texto fornecido.
Se a resposta não estiver no texto, diga exatamente: "Desculpe, não encontrei essa informação no documento." NÃO INVENTE DADOS.

DOCUMENTO:
"""
${textoDocumento}
"""

PERGUNTA DO USUÁRIO: ${pergunta}`;

    const modelRAG = genAI.getGenerativeModel({ model: MODELO_GEMINI });
    const result = await modelRAG.generateContent(promptRAG);
    const resposta = result.response.text();
    const tokens = lerTokens(result); // result.response.usageMetadata.totalTokenCount

    await Mensagem.create({
      userId: req.usuario.id,
      role: "user",
      text: `[Documento: ${nomeArquivo}] ${pergunta}`,
      origem: "documento",
    });
    await Mensagem.create({
      userId: req.usuario.id,
      role: "model",
      text: resposta,
      origem: "documento",
      tokensGastos: tokens,
    });
    avisarGastoDeToken(req, tokens);

    return res.json({ resposta, nomeArquivo });
  } catch (err) {
    console.error("[Chat Documento] Erro:", err.message);
    return res.status(500).json({ erro: "Erro ao processar o documento." });
  }
}

async function removerDocumento(req, res) {
  try {
    await DocumentoRAG.deleteOne({ userId: req.usuario.id });
    return res.json({ mensagem: "Documento removido do contexto." });
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao remover documento." });
  }
}

async function statusDocumento(req, res) {
  try {
    const doc = await DocumentoRAG.findOne({ userId: req.usuario.id }).select("nomeArquivo atualizadoEm");
    return res.json({ documento: doc ? { nomeArquivo: doc.nomeArquivo, atualizadoEm: doc.atualizadoEm } : null });
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao consultar documento." });
  }
}

module.exports = {
  listarHistorico,
  apagarHistorico,
  uploadImagem,
  conversar,
  conversarComDocumento,
  removerDocumento,
  statusDocumento,
};

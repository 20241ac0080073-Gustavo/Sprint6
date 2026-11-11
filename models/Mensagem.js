const mongoose = require("mongoose");

const mensagemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  role: { type: String, enum: ["user", "model"], required: true },
  text: { type: String, required: true },
  imageUrl: { type: String, default: null },
  // De onde veio a mensagem. "sala" = resposta do bot na sala pública
  // (fica fora do histórico privado do usuário, mas conta nos custos).
  origem: { type: String, enum: ["chat", "documento", "sala"], default: "chat" },
  // Telemetria (Sprint 8): tokens gastos pelo Gemini para gerar esta mensagem.
  tokensGastos: { type: Number, default: 0 },
  criadoEm: { type: Date, default: Date.now },
});

mensagemSchema.index({ criadoEm: 1 });

// Coleção já existente ("messages") preservada.
module.exports = mongoose.model("Mensagem", mensagemSchema, "messages");

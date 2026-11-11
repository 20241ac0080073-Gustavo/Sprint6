const mongoose = require("mongoose");

// Sprint 6 - RAG: texto extraído do documento, por usuário.
const documentoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true, unique: true },
  nomeArquivo: { type: String, required: true },
  texto: { type: String, required: true },
  atualizadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DocumentoRAG", documentoSchema);

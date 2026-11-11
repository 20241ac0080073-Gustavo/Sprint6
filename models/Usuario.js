const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  // RBAC (Sprint 8): "user" = usuário comum | "admin" = acesso ao Dashboard.
  // O papel só é alterado direto no MongoDB Atlas, nunca por rota pública.
  role: { type: String, default: "user" },
  criadoEm: { type: Date, default: Date.now },
});

// 3º argumento = nome da coleção já existente ("users"), para não perder
// os usuários cadastrados nas sprints anteriores.
module.exports = mongoose.model("Usuario", usuarioSchema, "users");

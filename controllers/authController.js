const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");

// O papel (role) vai dentro do JWT; o autenticarToken lê de lá.
function gerarToken(usuario) {
  return jwt.sign({ id: usuario._id, role: usuario.role || "user" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function dadosPublicos(usuario) {
  return { id: usuario._id, nome: usuario.nome, email: usuario.email, role: usuario.role };
}

async function registrar(req, res) {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: "Preencha nome, email e senha." });
    }
    if (await Usuario.findOne({ email })) {
      return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    // role NUNCA vem do body: todo cadastro público nasce como "user".
    const novo = await Usuario.create({ nome, email, senha: senhaHash, role: "user" });
    return res.status(201).json({ token: gerarToken(novo), usuario: dadosPublicos(novo) });
  } catch (err) {
    console.error("[Register] Erro:", err.message);
    return res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
  }
}

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }
    return res.json({ token: gerarToken(usuario), usuario: dadosPublicos(usuario) });
  } catch (err) {
    console.error("[Login] Erro:", err.message);
    return res.status(500).json({ erro: "Erro interno ao fazer login." });
  }
}

module.exports = { registrar, login };

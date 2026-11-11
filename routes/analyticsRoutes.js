// ========================================================================
// SPRINT 8 - Analytics (somente administradores)
// Os totais são calculados DENTRO do MongoDB (Aggregation Pipeline),
// sem baixar mensagens para somar em JavaScript.
// ========================================================================
const express = require("express");
const autenticarToken = require("../middlewares/autenticarToken");
const apenasAdmin = require("../middlewares/apenasAdmin");
const Mensagem = require("../models/Mensagem");
const Usuario = require("../models/Usuario");

const router = express.Router();

async function resumoDeTokens(req, res) {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 14, 1), 90);
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - (dias - 1));

    const [totais, porDia, totalUsuarios] = await Promise.all([
      // Totais gerais: soma de tokens + quantidade de mensagens
      Mensagem.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: "$tokensGastos" },
            totalMensagens: { $sum: 1 },
          },
        },
      ]),
      // Série diária para o gráfico (tokens e mensagens por dia)
      Mensagem.aggregate([
        { $match: { criadoEm: { $gte: desde } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$criadoEm", timezone: "America/Sao_Paulo" } },
            tokens: { $sum: "$tokensGastos" },
            mensagens: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Usuario.countDocuments(),
    ]);

    const t = totais[0] || { totalTokens: 0, totalMensagens: 0 };
    return res.json({
      totalTokens: t.totalTokens,
      totalMensagens: t.totalMensagens,
      totalUsuarios,
      porDia: porDia.map((d) => ({ dia: d._id, tokens: d.tokens, mensagens: d.mensagens })),
    });
  } catch (err) {
    console.error("[Analytics] Erro:", err.message);
    return res.status(500).json({ erro: "Erro ao gerar analytics." });
  }
}

// Proteção em camada dupla: 1) está logado? 2) é admin?
router.get("/tokens", autenticarToken, apenasAdmin, resumoDeTokens);

module.exports = router;

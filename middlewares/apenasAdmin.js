// Deve rodar DEPOIS do autenticarToken (que preenche req.usuario).
// Só deixa passar quem tem role "admin"; qualquer outro recebe 403.
function apenasAdmin(req, res, next) {
  if (req.usuario && req.usuario.role === "admin") {
    next();
  } else {
    return res.status(403).json({ erro: "Acesso negado: apenas administradores." });
  }
}

module.exports = apenasAdmin;

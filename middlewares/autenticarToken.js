const jwt = require("jsonwebtoken");

// Valida o JWT e disponibiliza req.usuario = { id, role } para os próximos
// middlewares/rotas. Tokens antigos (sem role) são tratados como "user".
function autenticarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não fornecido." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.id, role: payload.role || "user" };
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

module.exports = autenticarToken;

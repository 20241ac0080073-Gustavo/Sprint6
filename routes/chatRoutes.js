const express = require("express");
const multer = require("multer");
const autenticarToken = require("../middlewares/autenticarToken");
const c = require("../controllers/chatController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadDocumento = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/history", autenticarToken, c.listarHistorico);
router.delete("/history", autenticarToken, c.apagarHistorico);
router.post("/upload", autenticarToken, upload.single("imagem"), c.uploadImagem);
router.post("/chat", autenticarToken, c.conversar);
router.post("/chat/documento", autenticarToken, uploadDocumento.single("documento"), c.conversarComDocumento);
router.delete("/chat/documento", autenticarToken, c.removerDocumento);
router.get("/chat/documento", autenticarToken, c.statusDocumento);

module.exports = router;

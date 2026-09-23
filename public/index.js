// ========================================================================
// CONFIGURAÇÃO
// Troque pela URL do seu backend publicado no Render antes de fazer deploy.
// Em desenvolvimento local, aponte para http://localhost:3000
// ========================================================================
const API_URL = "https://SEU-BACKEND.onrender.com";

// ------------------------------------------------------------------------
// Elementos da tela
// ------------------------------------------------------------------------
const telaAuth = document.getElementById("tela-auth");
const telaChat = document.getElementById("tela-chat");

const abaLogin = document.getElementById("aba-login");
const abaCadastro = document.getElementById("aba-cadastro");
const formLogin = document.getElementById("form-login");
const formCadastro = document.getElementById("form-cadastro");
const erroLogin = document.getElementById("erro-login");
const erroCadastro = document.getElementById("erro-cadastro");

const listaMensagens = document.getElementById("lista-mensagens");
const formMensagem = document.getElementById("form-mensagem");
const inputMensagem = document.getElementById("input-mensagem");
const inputImagem = document.getElementById("input-imagem");
const previewImagem = document.getElementById("preview-imagem");
const btnLimpar = document.getElementById("btn-limpar");
const btnLogout = document.getElementById("btn-logout");

const bolinhaStatus = document.querySelector(".bolinha");
const textoStatus = document.getElementById("status-texto");

const btnModoDocumento = document.getElementById("btn-modo-documento");
const barraDocumento = document.getElementById("barra-documento");
const inputDocumento = document.getElementById("input-documento");
const documentoStatus = document.getElementById("documento-status");
const btnRemoverDocumento = document.getElementById("btn-remover-documento");
const labelImagem = document.getElementById("label-imagem");

let imagemSelecionada = null;
let arquivoDocumentoSelecionado = null; // novo PDF/TXT ainda não enviado
let modoDocumentoAtivo = false;

// ------------------------------------------------------------------------
// Alternar entre abas de Login e Cadastro
// ------------------------------------------------------------------------
abaLogin.addEventListener("click", () => {
  abaLogin.classList.add("ativa");
  abaCadastro.classList.remove("ativa");
  formLogin.classList.remove("escondido");
  formCadastro.classList.add("escondido");
});

abaCadastro.addEventListener("click", () => {
  abaCadastro.classList.add("ativa");
  abaLogin.classList.remove("ativa");
  formCadastro.classList.remove("escondido");
  formLogin.classList.add("escondido");
});

// ------------------------------------------------------------------------
// Cadastro
// ------------------------------------------------------------------------
formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroCadastro.textContent = "";

  const nome = document.getElementById("cadastro-nome").value;
  const email = document.getElementById("cadastro-email").value;
  const senha = document.getElementById("cadastro-senha").value;

  try {
    const resp = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      erroCadastro.textContent = dados.erro || "Erro ao cadastrar.";
      return;
    }

    entrarNoChat(dados.token);
  } catch (err) {
    erroCadastro.textContent = "Não foi possível conectar ao servidor.";
  }
});

// ------------------------------------------------------------------------
// Login
// ------------------------------------------------------------------------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroLogin.textContent = "";

  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;

  try {
    const resp = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      erroLogin.textContent = dados.erro || "Erro ao entrar.";
      return;
    }

    entrarNoChat(dados.token);
  } catch (err) {
    erroLogin.textContent = "Não foi possível conectar ao servidor.";
  }
});

// ------------------------------------------------------------------------
// Logout - remove o token e volta pra tela de autenticação
// ------------------------------------------------------------------------
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("token");
  listaMensagens.innerHTML = "";
  telaChat.classList.add("escondido");
  telaAuth.classList.remove("escondido");
});

// ------------------------------------------------------------------------
// Limpar histórico (memória)
// ------------------------------------------------------------------------
btnLimpar.addEventListener("click", async () => {
  if (!confirm("Tem certeza que deseja apagar todo o histórico?")) return;

  const token = localStorage.getItem("token");
  await fetch(`${API_URL}/api/history`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  listaMensagens.innerHTML = "";
});

// ========================================================================
// SPRINT 6 - MODO "CONVERSAR COM DOCUMENTO" (RAG)
// ========================================================================
btnModoDocumento.addEventListener("click", () => {
  modoDocumentoAtivo = !modoDocumentoAtivo;
  btnModoDocumento.classList.toggle("ativo", modoDocumentoAtivo);
  barraDocumento.classList.toggle("escondido", !modoDocumentoAtivo);
  labelImagem.classList.toggle("escondido", modoDocumentoAtivo); // não faz sentido imagem + doc juntos
  inputMensagem.placeholder = modoDocumentoAtivo
    ? "Pergunte algo sobre o documento..."
    : "Digite sua mensagem...";

  if (modoDocumentoAtivo) verificarDocumentoSalvo();
});

// Verifica no backend se o usuário já tem um documento carregado (persistência)
async function verificarDocumentoSalvo() {
  const token = localStorage.getItem("token");
  try {
    const resp = await fetch(`${API_URL}/api/chat/documento`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dados = await resp.json();
    if (dados.documento) {
      documentoStatus.textContent = `Documento ativo: ${dados.documento.nomeArquivo}`;
      btnRemoverDocumento.classList.remove("escondido");
    } else {
      documentoStatus.textContent = "Nenhum documento carregado. Anexe um PDF ou TXT.";
      btnRemoverDocumento.classList.add("escondido");
    }
  } catch (err) {
    documentoStatus.textContent = "Não foi possível verificar o documento salvo.";
  }
}

inputDocumento.addEventListener("change", () => {
  arquivoDocumentoSelecionado = inputDocumento.files[0] || null;
  if (arquivoDocumentoSelecionado) {
    documentoStatus.textContent = `Pronto para enviar: ${arquivoDocumentoSelecionado.name} (clique em Enviar após digitar a pergunta)`;
  }
});

btnRemoverDocumento.addEventListener("click", async () => {
  const token = localStorage.getItem("token");
  await fetch(`${API_URL}/api/chat/documento`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  arquivoDocumentoSelecionado = null;
  inputDocumento.value = "";
  verificarDocumentoSalvo();
});

// ------------------------------------------------------------------------
// Seleção de imagem (preview simples)
// ------------------------------------------------------------------------
inputImagem.addEventListener("change", () => {
  imagemSelecionada = inputImagem.files[0] || null;
  previewImagem.textContent = imagemSelecionada ? imagemSelecionada.name : "";
  previewImagem.classList.toggle("escondido", !imagemSelecionada);
});

// ------------------------------------------------------------------------
// Enviar mensagem (com ou sem imagem)
// ------------------------------------------------------------------------
formMensagem.addEventListener("submit", async (e) => {
  e.preventDefault();
  const texto = inputMensagem.value.trim();
  if (!texto) return;

  if (modoDocumentoAtivo) {
    await enviarPerguntaSobreDocumento(texto);
    return;
  }

  const token = localStorage.getItem("token");
  let imageUrl = null;

  // Se tiver imagem selecionada, sobe pro Cloudinary primeiro
  if (imagemSelecionada) {
    const formData = new FormData();
    formData.append("imagem", imagemSelecionada);

    try {
      const respUpload = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const dadosUpload = await respUpload.json();
      if (respUpload.ok) imageUrl = dadosUpload.url;
    } catch (err) {
      console.error("Falha no upload da imagem:", err);
    }
  }

  adicionarMensagemNaTela("user", texto, imageUrl);
  inputMensagem.value = "";
  imagemSelecionada = null;
  inputImagem.value = "";
  previewImagem.classList.add("escondido");

  const balaoCarregando = adicionarMensagemNaTela("model", "Digitando...");

  try {
    const resp = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mensagem: texto, imageUrl }),
    });
    const dados = await resp.json();
    if (resp.ok) {
      renderizarConteudoModelo(balaoCarregando, dados.resposta);
    } else {
      balaoCarregando.textContent = dados.erro || "Ocorreu um erro ao responder.";
    }
  } catch (err) {
    balaoCarregando.textContent = "Não foi possível falar com o servidor.";
  }
});

// ------------------------------------------------------------------------
// Envia a pergunta (e o arquivo, se houver um novo selecionado) para
// /api/chat/documento — o fluxo de RAG da Sprint 6.
// ------------------------------------------------------------------------
async function enviarPerguntaSobreDocumento(pergunta) {
  const token = localStorage.getItem("token");

  if (!arquivoDocumentoSelecionado) {
    // Sem arquivo novo: precisa já existir um documento salvo no backend
    const temDocumentoSalvo = !btnRemoverDocumento.classList.contains("escondido");
    if (!temDocumentoSalvo) {
      documentoStatus.textContent = "Anexe um PDF ou TXT antes de perguntar.";
      return;
    }
  }

  adicionarMensagemNaTela("user", pergunta);
  inputMensagem.value = "";
  const balaoCarregando = adicionarMensagemNaTela("model", "Lendo o documento...");

  const formData = new FormData();
  formData.append("pergunta", pergunta);
  if (arquivoDocumentoSelecionado) {
    formData.append("documento", arquivoDocumentoSelecionado);
  }

  try {
    const resp = await fetch(`${API_URL}/api/chat/documento`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const dados = await resp.json();

    if (resp.ok) {
      renderizarConteudoModelo(balaoCarregando, dados.resposta);
      documentoStatus.textContent = `Documento ativo: ${dados.nomeArquivo}`;
      btnRemoverDocumento.classList.remove("escondido");
    } else {
      balaoCarregando.textContent = dados.erro || "Erro ao consultar o documento.";
    }
  } catch (err) {
    balaoCarregando.textContent = "Não foi possível falar com o servidor.";
  }

  arquivoDocumentoSelecionado = null;
  inputDocumento.value = "";
}

// ------------------------------------------------------------------------
// Renderiza uma mensagem na tela e retorna o elemento criado
// ------------------------------------------------------------------------
function adicionarMensagemNaTela(role, texto, imageUrl) {
  const div = document.createElement("div");
  div.className = `mensagem ${role}`;

  if (role === "model") {
    renderizarConteudoModelo(div, texto);
  } else {
    div.textContent = texto;
  }

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    div.appendChild(img);
  }

  listaMensagens.appendChild(div);
  listaMensagens.scrollTop = listaMensagens.scrollHeight;
  return div;
}

// Renderiza a resposta da IA como Markdown (negrito, listas, etc.) usando
// marked.js, já que o Gemini frequentemente devolve texto formatado.
function renderizarConteudoModelo(elemento, texto) {
  if (window.marked) {
    elemento.innerHTML = marked.parse(texto);
  } else {
    elemento.textContent = texto; // fallback caso o marked.js não carregue
  }
}

// ------------------------------------------------------------------------
// Ao entrar (login/cadastro OK): guarda token, mostra chat, carrega histórico
// ------------------------------------------------------------------------
function entrarNoChat(token) {
  localStorage.setItem("token", token);
  telaAuth.classList.add("escondido");
  telaChat.classList.remove("escondido");
  carregarHistorico();
}

async function carregarHistorico() {
  const token = localStorage.getItem("token");
  try {
    const resp = await fetch(`${API_URL}/api/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const historico = await resp.json();
    listaMensagens.innerHTML = "";
    historico.forEach((m) => adicionarMensagemNaTela(m.role, m.text, m.imageUrl));
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// ========================================================================
// INDICADOR DE STATUS - consulta de verdade a rota /api/health
// Isso é o que a devolutiva do professor pediu: o indicador não pode
// mentir. Se o /api/health responder 503 (banco caiu) ou der erro de
// rede, a luz fica vermelha, mesmo que o servidor Express esteja de pé.
// ========================================================================
async function verificarSaude() {
  try {
    const resp = await fetch(`${API_URL}/api/health`);
    const dados = await resp.json();

    const saudavel = resp.ok && dados.status === "ok" && dados.bancoDeDados === "conectado";

    bolinhaStatus.classList.toggle("online", saudavel);
    bolinhaStatus.classList.toggle("offline", !saudavel);
    textoStatus.textContent = saudavel
      ? "Sistema Operacional"
      : "API com problemas (banco indisponível)";
  } catch (err) {
    bolinhaStatus.classList.remove("online");
    bolinhaStatus.classList.add("offline");
    textoStatus.textContent = "API Offline";
  }
}

verificarSaude();
setInterval(verificarSaude, 30000); // consulta a cada 30 segundos

// ------------------------------------------------------------------------
// Se já existir um token salvo, entra direto no chat
// ------------------------------------------------------------------------
const tokenSalvo = localStorage.getItem("token");
if (tokenSalvo) {
  entrarNoChat(tokenSalvo);
}
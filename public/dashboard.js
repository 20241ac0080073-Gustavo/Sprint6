// ========================================================================
// Centro de Comando (Sprint 8): busca /api/analytics/tokens (admin) e
// desenha os gráficos com Chart.js. Desafio Hacker: o evento
// "novoGastoDeToken" faz o gráfico subir sozinho, sem F5.
// ========================================================================
const API_URL = "https://sprint6-nyhw.onrender.com"; // mesmo valor do index.js
const DIAS = 14;

const aviso = document.getElementById("aviso");
const aoVivo = document.getElementById("ao-vivo");
const kpiTokens = document.getElementById("kpi-tokens");
const kpiMensagens = document.getElementById("kpi-mensagens");
const kpiUsuarios = document.getElementById("kpi-usuarios");

const fmt = (n) => Number(n).toLocaleString("pt-BR");

let graficoTokens = null;
let graficoMensagens = null;
let totais = { tokens: 0, mensagens: 0, usuarios: 0 };

// Data de hoje no fuso de São Paulo (mesmo fuso usado no $dateToString do back-end)
function hojeISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Gera os últimos N dias e preenche com 0 os dias sem mensagens
function montarSerie(porDia) {
  const mapa = new Map(porDia.map((d) => [d.dia, d]));
  const dias = [];
  const base = new Date(hojeISO() + "T12:00:00");
  for (let i = DIAS - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return {
    dias,
    tokens: dias.map((d) => (mapa.get(d) ? mapa.get(d).tokens : 0)),
    mensagens: dias.map((d) => (mapa.get(d) ? mapa.get(d).mensagens : 0)),
  };
}

const rotulo = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

function desenhar(serie) {
  const opcoes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#9a9dae" }, grid: { color: "#2a2e3d" } },
      y: { beginAtZero: true, ticks: { color: "#9a9dae" }, grid: { color: "#2a2e3d" } },
    },
  };
  graficoTokens = new Chart(document.getElementById("graficoTokens"), {
    type: "bar",
    data: {
      labels: serie.dias.map(rotulo),
      datasets: [{ label: "Tokens", data: serie.tokens, backgroundColor: "#f2a154" }],
    },
    options: opcoes,
  });
  graficoMensagens = new Chart(document.getElementById("graficoMensagens"), {
    type: "line",
    data: {
      labels: serie.dias.map(rotulo),
      datasets: [{ label: "Mensagens", data: serie.mensagens, borderColor: "#4ade80", tension: 0.3 }],
    },
    options: opcoes,
  });
  graficoTokens.$dias = serie.dias; // guarda os dias para o tempo real
}

function mostrarKpis() {
  kpiTokens.textContent = fmt(totais.tokens);
  kpiMensagens.textContent = fmt(totais.mensagens);
  kpiUsuarios.textContent = fmt(totais.usuarios);
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.remove("escondido");
}

async function carregar() {
  const token = localStorage.getItem("token");
  if (!token) {
    mostrarAviso("Você precisa entrar no chat primeiro. Redirecionando...");
    setTimeout(() => (location.href = "index.html"), 1500);
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/api/analytics/tokens?dias=${DIAS}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 401) {
      localStorage.removeItem("token");
      mostrarAviso("Sessão expirada. Faça login novamente.");
      setTimeout(() => (location.href = "index.html"), 1500);
      return;
    }
    if (resp.status === 403) {
      mostrarAviso("Acesso negado: esta página é exclusiva para administradores. (Se você acabou de virar admin, saia e entre de novo para renovar o token.)");
      return;
    }
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const dados = await resp.json();
    totais = { tokens: dados.totalTokens, mensagens: dados.totalMensagens, usuarios: dados.totalUsuarios };
    mostrarKpis();
    desenhar(montarSerie(dados.porDia));
    conectarTempoReal(token);
  } catch (err) {
    console.error(err);
    mostrarAviso("Não foi possível carregar os dados do servidor.");
  }
}

// ---------------- Desafio Hacker: tempo real ----------------
function conectarTempoReal(token) {
  const socket = io(API_URL, { auth: { token, painel: true } });

  socket.on("connect", () => {
    aoVivo.textContent = "Tempo real: conectado";
    aoVivo.className = "sala-conexao ok";
  });
  socket.on("disconnect", () => {
    aoVivo.textContent = "Tempo real: reconectando...";
    aoVivo.className = "sala-conexao falha";
  });
  socket.on("connect_error", () => {
    aoVivo.textContent = "Tempo real: indisponível";
    aoVivo.className = "sala-conexao falha";
  });

  socket.on("novoGastoDeToken", (quantidade) => {
    const q = Number(quantidade) || 0;
    if (!q || !graficoTokens) return;

    totais.tokens += q;
    totais.mensagens += 1; // cada gasto corresponde a 1 resposta da IA salva
    mostrarKpis();

    // Se a página ficou aberta a virada do dia, o "hoje" pode não estar no eixo
    const dias = graficoTokens.$dias;
    const hoje = hojeISO();
    let i = dias.indexOf(hoje);
    if (i === -1) {
      dias.push(hoje);
      dias.shift();
      graficoTokens.data.datasets[0].data.shift();
      graficoTokens.data.datasets[0].data.push(0);
      graficoMensagens.data.datasets[0].data.shift();
      graficoMensagens.data.datasets[0].data.push(0);
      const labels = dias.map(rotulo);
      graficoTokens.data.labels = labels;
      graficoMensagens.data.labels = labels;
      i = dias.length - 1;
    }
    graficoTokens.data.datasets[0].data[i] += q;
    graficoMensagens.data.datasets[0].data[i] += 1;
    graficoTokens.update();
    graficoMensagens.update();
  });
}

carregar();

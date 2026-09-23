# Agente IA — Check-up Cloud (Sprint 5)

Chatbot com IA generativa, memória persistente, suporte a imagens e clima em tempo real, com auditoria de qualidade, health check real e monitoramento de disponibilidade.

**Backend em produção:** `https://SEU-BACKEND.onrender.com`
**Front-end em produção:** `https://SEU-FRONTEND.vercel.app`

## Tecnologias utilizadas

- **Backend:** Node.js, Express
- **Banco de dados:** MongoDB (Mongoose)
- **Autenticação:** JWT + bcrypt
- **IA Generativa:** Google Gemini (`@google/generative-ai`), com Function Calling
- **Upload de imagens:** Cloudinary
- **Clima (function calling):** Open-Meteo (API gratuita, sem chave)
- **Front-end:** HTML, CSS e JavaScript puro
- **Monitoramento:** UptimeRobot consultando `/api/health`

## Funcionalidades

- Cadastro e login com JWT
- Chat com IA que mantém memória das conversas (MongoDB)
- Botão para limpar histórico (apaga do banco de verdade)
- Envio de imagens (Cloudinary) com interpretação pela IA
- Function Calling: a IA consulta a temperatura atual de qualquer cidade
- Rota `GET /api/health` que verifica de verdade a conexão com o MongoDB
- Indicador visual 🟢/🔴 no front-end, integrado ao `/api/health`
- **RAG (Sprint 6):** upload de PDF/TXT e chat restrito ao conteúdo do documento, com anti-alucinação e persistência no MongoDB (não precisa reenviar o arquivo a cada pergunta)

## RAG — Conversar com Documento (Sprint 6)

Rota `POST /api/chat/documento` (protegida por JWT):

- Recebe um arquivo (`documento`, PDF ou TXT) e uma `pergunta`, via `multipart/form-data`.
- O PDF é processado inteiramente em memória (`multer.memoryStorage()`) com `pdf-parse` — nunca é salvo em disco no servidor.
- O texto extraído é injetado em um prompt que instrui a IA a responder **apenas** com base no documento, dizendo explicitamente que não encontrou a informação quando ela não está no texto (evita alucinação).
- O texto extraído é salvo no MongoDB associado ao usuário, então perguntas seguintes não exigem reenviar o arquivo — basta digitar a pergunta com o modo "Conversar com Documento" ativo.
- `DELETE /api/chat/documento` remove o documento salvo e encerra essa "sessão" de RAG.
- `GET /api/chat/documento` informa se já existe um documento carregado para o usuário logado.

No front-end, o botão **"📄 Conversar com Documento"** alterna para esse modo, mostrando onde anexar o arquivo e o nome do documento atualmente ativo. As respostas da IA (nesse modo e no chat normal) são renderizadas com `marked.js`, exibindo negrito, listas etc. corretamente.

## Como rodar localmente

```bash
# instalar dependências
npm install

# copiar o arquivo de exemplo e preencher com suas chaves reais
cp .env.example .env

# subir o servidor
npm start
```

O front-end (pasta `public/`) pode ser aberto com qualquer servidor estático (ex: extensão Live Server do VS Code). Lembre de configurar a constante `API_URL` em `public/index.js` apontando para o backend correto.

## Variáveis de ambiente necessárias

Veja `.env.example`. Nenhuma chave real deve ser commitada no repositório.

## Health Check

A rota `GET /api/health` retorna:

```json
{
  "status": "ok",
  "bancoDeDados": "conectado",
  "timestamp": "2026-09-15T10:30:00.000Z"
}
```

Se o MongoDB estiver indisponível, a rota retorna **HTTP 503** com `"bancoDeDados": "desconectado"` — o status HTTP reflete a saúde real do sistema, não apenas se o processo Express está de pé.

## Monitoramento (UptimeRobot)

Um monitor HTTP(s) foi configurado no [UptimeRobot](https://uptimerobot.com) apontando para `/api/health`, com intervalo de 14 minutos, para evitar o "cold start" do plano gratuito do Render e alertar em caso de indisponibilidade.

## Relatório de Auditoria

O relatório de QA desta Sprint (matriz de testes, bugs encontrados/corrigidos e evidências) está disponível em `relatorio-auditoria.docx` (ou no link do Google Docs informado na entrega).
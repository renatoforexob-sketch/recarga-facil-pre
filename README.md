# Recarga Fácil — Hostinger Node.js + React

Projeto React/Vite com backend Node.js/Express, preparado para hospedagem Node.js da Hostinger.

## Estrutura
- `src/` — frontend React
- `public/` — arquivos públicos
- `server.js` — servidor Express e APIs `/api/pix` e `/api/status`
- `dist/` — build de produção (gerado por `npm run build`)
- `.env.example` — variáveis de ambiente

## Hostinger
1. Crie uma aplicação Node.js no painel da Hostinger.
2. Envie o projeto para a pasta da aplicação.
3. Selecione Node.js 18+ (recomendado Node 20+).
4. Instale dependências com `npm install`.
5. Execute `npm run build`.
6. Defina o arquivo de inicialização como `server.js`.
7. Configure as variáveis de ambiente do `.env.example` no painel.
8. Reinicie a aplicação.

O servidor escuta `process.env.PORT`, conforme exigido pelo ambiente Node da hospedagem.

## Segurança
Nunca coloque `BLACKCAT_API_KEY` no React, em `src/` ou em arquivos públicos.

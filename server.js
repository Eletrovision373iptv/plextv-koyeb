'use strict';

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
// Porta dinâmica para Koyeb/Render
const PORT = process.env.PORT || 8000;

// --- CONFIGURAÇÕES ---
const M3U_FILE = path.join(__dirname, 'lista_brasil.m3u');
const M3U_URL = 'https://iptv-org.github.io/iptv/countries/br.m3u';

let canaisCache = [];

// ============================================================
// 1. BAIXADOR E PROCESSADOR (IGUAL AO DA PLUTO)
// ============================================================
async function atualizarLista() {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(M3U_FILE);
        https.get(M3U_URL, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const data = fs.readFileSync(M3U_FILE, 'utf8');
                const linhas = data.split('\n');
                let novaLista = [];
                let canalAtual = null;

                for (let linha of linhas) {
                    linha = linha.trim();
                    if (linha.startsWith('#EXTINF')) {
                        const logoMatch = linha.match(/tvg-logo="([^"]*)"/);
                        const nome = linha.split(',').pop().trim();
                        canalAtual = {
                            id: `br_${novaLista.length + 1}`,
                            nome: nome,
                            logo: logoMatch ? logoMatch[1] : 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/1200px-Flag_of_Brazil.svg.png',
                            url: null
                        };
                    } else if (linha.startsWith('http') && canalAtual) {
                        canalAtual.url = linha;
                        novaLista.push(canalAtual);
                        canalAtual = null;
                    }
                }
                canaisCache = novaLista;
                console.log(`✅ Lista Pronta: ${canaisCache.length} canais.`);
                resolve(canaisCache.length);
            });
        });
    });
}

// Inicia a lista ao ligar o servidor
atualizarLista();

// ============================================================
// 2. PAINEL VISUAL
// ============================================================
app.get('/', (req, res) => {
    const host = req.get('host');
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Brasil TV - Eletrovision</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: #0a0a0a; color: #fff; }
            .card { background: #1a1a1a; border: 1px solid #333; margin-bottom: 10px; }
            .logo-img { height: 50px; object-fit: contain; }
            .btn-play { background: #009c3b; color: #fff; font-weight: bold; }
        </style>
    </head>
    <body class="p-3">
        <h3>🇧🇷 BRASIL <span style="color:#ffdf00">TV</span></h3>
        <hr>
        <div class="row g-2">
            ${canaisCache.map(ch => `
                <div class="col-6 col-md-3">
                    <div class="card p-2 text-center">
                        <img src="${ch.logo}" class="logo-img mb-2">
                        <small class="d-block text-truncate">${ch.nome}</small>
                        <a href="/play/${ch.id}" target="_blank" class="btn btn-sm btn-play mt-2">ASSISTIR</a>
                    </div>
                </div>
            `).join('')}
        </div>
    </body>
    </html>`;
    res.send(html);
});

// ============================================================
// 3. ROTA DE PLAY (REDIRECIONAMENTO DIRETO)
// ============================================================
app.get('/play/:id', (req, res) => {
    const canal = canaisCache.find(c => c.id === req.params.id);
    if (canal && canal.url) {
        console.log(`▶️ Redirecionando: ${canal.nome}`);
        res.redirect(canal.url);
    } else {
        res.status(404).send("Canal não encontrado.");
    }
});

// ============================================================
// 4. ROTA DA LISTA M3U (PARA XCIPTV / OTT)
// ============================================================
app.get('/lista.m3u', (req, res) => {
    const host = req.get('host');
    let m3u = "#EXTM3U\n";
    canaisCache.forEach(ch => {
        m3u += `#EXTINF:-1 tvg-logo="${ch.logo}",${ch.nome}\nhttp://${host}/play/${ch.id}\n`;
    });
    res.setHeader('Content-Type', 'text/plain');
    res.send(m3u);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Brasil TV Online na porta ${PORT}`);
});

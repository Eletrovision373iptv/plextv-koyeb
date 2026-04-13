'use strict';

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Configuração das Listas M3U
const FONTES_M3U = [
    { 
        nome: 'Brasil', 
        url: 'https://raw.githubusercontent.com/Eletrovision373iptv/plextv-koyeb/main/lista_brasil.m3u' 
    },
     { 
        nome: 'pluto', 
        url: 'https://raw.githubusercontent.com/iprtl/m3u/refs/heads/live/Pluto.m3u' 
    },
    { 
        nome: 'Band', 
        url: 'https://raw.githubusercontent.com/Eletrovision373iptv/minha-band-bat-pc/refs/heads/main/lista_completa.m3u' 
    }
];

// Pasta temporária para salvar as listas baixadas
const M3U_DIR = path.join(__dirname, 'listas_cache');
if (!fs.existsSync(M3U_DIR)) fs.mkdirSync(M3U_DIR);

let canaisCache = [];

async function atualizarLista() {
    let novaListaGeral = [];

    for (const fonte of FONTES_M3U) {
        const fileName = `${fonte.nome.toLowerCase()}.m3u`;
        const filePath = path.join(M3U_DIR, fileName);

        console.log(`📡 Baixando lista ${fonte.nome}...`);

        try {
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(filePath);
                https.get(fonte.url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Falha ao baixar: ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });

            const data = fs.readFileSync(filePath, 'utf8');
            const linhas = data.split('\n');
            let canalAtual = null;

            for (let linha of linhas) {
                linha = linha.trim();
                if (linha.startsWith('#EXTINF')) {
                    const logoMatch = linha.match(/tvg-logo="([^"]*)"/);
                    let nome = "Canal Sem Nome";
                    const nameMatch = linha.match(/tvg-name="([^"]*)"/);
                    
                    if (nameMatch && nameMatch[1]) {
                        nome = nameMatch[1];
                    } else {
                        const partes = linha.split(',');
                        if (partes.length > 1) nome = partes.pop().trim();
                    }

                    canalAtual = {
                        id: `ch_${novaListaGeral.length + 1}`,
                        nome: nome,
                        logo: logoMatch ? logoMatch[1] : 'https://placehold.co/100x60?text=TV',
                        url: null
                    };
                } else if (linha.startsWith('http') && canalAtual) {
                    canalAtual.url = linha;
                    novaListaGeral.push(canalAtual);
                    canalAtual = null;
                }
            }
        } catch (err) {
            console.error(`❌ Erro na fonte ${fonte.nome}:`, err.message);
        }
    }

    canaisCache = novaListaGeral;
    console.log(`✅ Total de canais carregados: ${canaisCache.length}`);
}

// Atualiza ao iniciar
atualizarLista();

// Rota Principal (Interface)
app.get('/', (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    let html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Brasil TV - Eletrovision</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: #0a0a0a; color: #fff; font-family: 'Segoe UI', sans-serif; }
            .search-box { background: #1a1a1a; border: 1px solid #009c3b; color: #fff; border-radius: 25px; padding: 10px 20px; }
            .search-box:focus { background: #222; color: #fff; border-color: #ffdf00; box-shadow: none; }
            .card { background: #1a1a1a; border: 1px solid #333; transition: 0.3s; height: 100%; display: flex; flex-direction: column; }
            .card:hover { border-color: #009c3b; transform: scale(1.03); }
            .logo-img { height: 60px; width: 100%; object-fit: contain; background: #222; padding: 5px; border-radius: 5px; }
            .canal-nome { color: #ffdf00; font-size: 0.85rem; font-weight: bold; min-height: 45px; display: flex; align-items: center; justify-content: center; }
            .btn-play { background: #009c3b; color: #fff; border: none; width: 100%; margin-bottom: 8px; font-weight: bold; }
            .btn-copy { background: #ffdf00; color: #000; border: none; width: 100%; font-weight: bold; font-size: 10px; }
            .btn-play:hover { background: #007d2f; color: #fff; }
            .btn-copy:hover { background: #d4ba00; color: #000; }
            .hidden { display: none; }
        </style>
    </head>
    <body class="p-3">
        <div class="container text-center">
            <h2 class="mb-1">🇧🇷 BRASIL <span style="color:#ffdf00">TV</span></h2>
            <p class="text-muted small">Eletrovision IPTV - Sistema de Busca Ativo</p>
            
            <div class="row justify-content-center mb-4">
                <div class="col-md-6">
                    <input type="text" id="searchInput" class="form-control search-box" placeholder="🔍 Buscar canal (ex: Globo, Band, Record)..." onkeyup="filterChannels()">
                </div>
            </div>

            <hr>
            
            <div class="row row-cols-2 row-cols-md-4 row-cols-lg-6 g-3" id="channelList">
                ${canaisCache.map(ch => `
                    <div class="col channel-card" data-name="${ch.nome.toLowerCase()}">
                        <div class="card p-2 text-center">
                            <img src="${ch.logo}" class="logo-img mb-2" onerror="this.src='https://placehold.co/100x60?text=TV'">
                            <div class="canal-nome">${ch.nome}</div>
                            <div class="mt-auto">
                                <a href="/play/${ch.id}" target="_blank" class="btn btn-sm btn-play">ASSISTIR</a>
                                <button onclick="copiarLink('${baseUrl}/play/${ch.id}')" class="btn btn-sm btn-copy text-uppercase">Copiar Link</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <script>
            function filterChannels() {
                const input = document.getElementById('searchInput').value.toLowerCase();
                const cards = document.getElementsByClassName('channel-card');
                for (let i = 0; i < cards.length; i++) {
                    const name = cards[i].getAttribute('data-name');
                    cards[i].classList.toggle('hidden', !name.includes(input));
                }
            }

            function copiarLink(url) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Link copiado!\\n' + url);
                }).catch(() => alert('Erro ao copiar.'));
            }
        </script>
    </body>
    </html>`;
    res.send(html);
});

// Rota de Reprodução
app.get('/play/:id', (req, res) => {
    const canal = canaisCache.find(c => c.id === req.params.id);
    if (canal && canal.url) {
        res.redirect(canal.url);
    } else {
        res.status(404).send("Canal não encontrado.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Eletrovision rodando na porta ${PORT}`);
});

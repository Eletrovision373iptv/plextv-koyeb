'use strict';

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

const M3U_FILE = path.join(__dirname, 'lista_brasil.m3u');
const M3U_URL = 'https://raw.githubusercontent.com/Eletrovision373iptv/plextv-koyeb/main/lista_brasil.m3u';

let canaisCache = [];

async function atualizarLista() {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(M3U_FILE);
        https.get(M3U_URL, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                try {
                    const data = fs.readFileSync(M3U_FILE, 'utf8');
                    const linhas = data.split('\n');
                    let novaLista = [];
                    let canalAtual = null;

                    for (let linha of linhas) {
                        linha = linha.trim();
                        if (linha.startsWith('#EXTINF')) {
                            const logoMatch = linha.match(/tvg-logo="([^"]*)"/);
                            
                            // Tenta pegar o nome completo (tvg-name ou após a vírgula)
                            let nome = "Canal Sem Nome";
                            const nameMatch = linha.match(/tvg-name="([^"]*)"/);
                            if (nameMatch && nameMatch[1]) {
                                nome = nameMatch[1];
                            } else {
                                const partes = linha.split(',');
                                if (partes.length > 1) nome = partes.pop().trim();
                            }

                            canalAtual = {
                                id: `br_${novaLista.length + 1}`,
                                nome: nome,
                                logo: logoMatch ? logoMatch[1] : 'https://placehold.co/100x60?text=TV',
                                url: null
                            };
                        } else if (linha.startsWith('http') && canalAtual) {
                            canalAtual.url = linha;
                            novaLista.push(canalAtual);
                            canalAtual = null;
                        }
                    }
                    canaisCache = novaLista;
                    console.log(`✅ Lista Atualizada: ${canaisCache.length} canais.`);
                    resolve(canaisCache.length);
                } catch (err) {
                    console.error("Erro ao processar lista:", err);
                    resolve(0);
                }
            });
        });
    });
}

atualizarLista();

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
            // Função de Busca em Tempo Real
            function filterChannels() {
                const input = document.getElementById('searchInput').value.toLowerCase();
                const cards = document.getElementsByClassName('channel-card');
                
                for (let i = 0; i < cards.length; i++) {
                    const name = cards[i].getAttribute('data-name');
                    if (name.includes(input)) {
                        cards[i].classList.remove('hidden');
                    } else {
                        cards[i].classList.add('hidden');
                    }
                }
            }

            function copiarLink(url) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Link copiado com sucesso!\\n' + url);
                }).catch(err => {
                    alert('Erro ao copiar.');
                });
            }
        </script>
    </body>
    </html>`;
    res.send(html);
});

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

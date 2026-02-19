'use strict';

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

const M3U_FILE = path.join(__dirname, 'lista_brasil.m3u');
const M3U_URL = 'https://iptv-org.github.io/iptv/countries/br.m3u';

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
                            const nome = linha.split(',').pop().trim();
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
    let html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Brasil TV - Eletrovision</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: #0a0a0a; color: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .card { background: #1a1a1a; border: 1px solid #333; transition: 0.3s; height: 100%; }
            .card:hover { border-color: #009c3b; transform: scale(1.02); }
            .logo-img { height: 60px; object-fit: contain; background: #222; padding: 5px; border-radius: 5px; }
            .btn-play { background: #009c3b; color: #fff; border: none; width: 100%; margin-bottom: 8px; font-weight: bold; }
            .btn-copy { background: #ffdf00; color: #000; border: none; width: 100%; font-weight: bold; }
            .btn-play:hover { background: #007d2f; color: #fff; }
            .btn-copy:hover { background: #d4ba00; color: #000; }
            hr { border-color: #333; opacity: 1; }
        </style>
    </head>
    <body class="p-3">
        <div class="container text-center">
            <h2 class="mb-1">🇧🇷 BRASIL <span style="color:#ffdf00">TV</span></h2>
            <p class="text-muted small">Eletrovision IPTV - Painel de Controle</p>
            <hr>
            <div class="row row-cols-2 row-cols-md-4 row-cols-lg-6 g-3">
                ${canaisCache.map(ch => `
                    <div class="col">
                        <div class="card p-2 text-center">
                            <img src="${ch.logo}" class="logo-img mb-2" onerror="this.src='https://placehold.co/100x60?text=TV'">
                            <p class="small text-truncate mb-2 fw-bold" title="${ch.nome}">${ch.nome}</p>
                            <div class="mt-auto">
                                <a href="/play/${ch.id}" target="_blank" class="btn btn-sm btn-play">ASSISTIR</a>
                                <button onclick="copiarLink('${ch.url}')" class="btn btn-sm btn-copy text-uppercase" style="font-size: 10px;">Copiar Link</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <script>
            function copiarLink(url) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Sucesso! Link do canal copiado para a área de transferência.');
                }).catch(err => {
                    alert('Erro ao copiar o link.');
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

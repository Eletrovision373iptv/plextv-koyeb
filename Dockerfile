# Usa uma versão leve do Node.js
FROM node:22-slim

# Cria a pasta do aplicativo
WORKDIR /app

# Copia apenas o package.json
COPY package.json ./

# Instala as dependências (o Docker vai gerar o lockfile sozinho aqui dentro)
RUN npm install

# Copia o resto dos arquivos (server.js, etc)
COPY . .

# Expõe a porta que você configurou no código
EXPOSE 8000

# Comando para ligar o servidor
CMD ["node", "server.js"]

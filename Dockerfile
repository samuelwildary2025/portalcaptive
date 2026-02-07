# Stage 1: Build
FROM node:18-slim AS builder

# Instalar dependências do sistema necessárias para o Prisma (OpenSSL)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Gera o cliente do Prisma
RUN npx prisma generate

# Stage 2: Production
FROM node:18-slim

# Instalar dependências do sistema necessárias para o Prisma em produção
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# Variável de ambiente padrão
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]

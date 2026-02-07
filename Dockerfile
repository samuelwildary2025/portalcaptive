# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Gera o cliente do Prisma
RUN npx prisma generate

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# Variável de ambiente padrão (pode ser sobrescrita no Easypanel)
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]

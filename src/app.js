const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Configuração do View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');

app.use('/portal', portalRoutes);
app.use('/admin', adminRoutes);

// Rota padrão (Landing page do SaaS ou redirecionamento)
app.get('/', (req, res) => {
  res.send('<h1>Bem-vindo ao SaaS Portal Captive</h1><p><a href="/admin">Ir para Painel Admin</a></p>');
});

app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  // Teste de conexão com Banco de Dados
  try {
    await prisma.$connect();
    console.log('✅ Banco de dados conectado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error);
  }
});

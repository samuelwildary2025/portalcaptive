const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dashboard Admin
// Dashboard Admin
router.get('/', async (req, res) => {
  try {
    console.log('Tentando carregar dashboard admin...');
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { wifiUsers: true, accessLogs: true }
        }
      }
    });
    console.log(`Sucesso! Encontrados ${tenants.length} tenants.`);
    res.render('admin-dashboard', { tenants });
  } catch (error) {
    console.error('ERRO FATAL AO CARREGAR DASHBOARD:', error);
    res.status(500).send(`Erro ao carregar dashboard: ${error.message}`);
  }
});

// Criar Novo Cliente (Tenant)
router.post('/tenants', async (req, res) => {
  const { name, email, password, logoUrl, portalTitle } = req.body;
  try {
    await prisma.tenant.create({
      data: {
        name,
        email,
        password,
        logoUrl,
        portalTitle: portalTitle || undefined
      }
    });
    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(400).send('Erro ao criar cliente');
  }
});

module.exports = router;

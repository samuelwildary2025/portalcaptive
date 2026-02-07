const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tela de Login do Captive Portal
// O roteador redireciona para cá: /portal/:tenantId?mac=...&ip=...&url=...
router.get('/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  
  // LOG DE DEBUG PARA AP 360
  console.log('--- NOVA CONEXÃO DE ROTEADOR ---');
  console.log('Tenant ID:', tenantId);
  console.log('Query Params recebidos:', req.query);
  console.log('Headers:', req.headers);
  console.log('--------------------------------');

  const { mac, ip, url, login_url, gw_address, gw_port, continue: continueUrl, ap_mac, ssid, redirect_uri } = req.query; 

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).send('Estabelecimento não encontrado.');
    }

    res.render('portal-login', {
      tenant,
      mac,
      ip,
      originalUrl: url || continueUrl, // Intelbras usa 'continue'
      loginUrl: login_url || redirect_uri, // Intelbras usa 'redirect_uri'
      ssid,
      ap_mac
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno.');
  }
});

// Processar Login
router.post('/:tenantId/login', async (req, res) => {
  const { tenantId } = req.params;
  const { mac, email, cpf, whatsapp, loginUrl, originalUrl } = req.body;

  try {
    // 1. Cadastrar ou Atualizar Usuário
    let user = await prisma.wifiUser.findFirst({
      where: { tenantId, macAddress: mac }
    });

    if (!user) {
      user = await prisma.wifiUser.create({
        data: {
          tenantId,
          macAddress: mac,
          email,
          whatsapp,
          cpf
        }
      });
    } else {
        // Atualiza dados se mudaram
        await prisma.wifiUser.update({
            where: { id: user.id },
            data: { email, cpf, whatsapp }
        });
    }

    // 2. Registrar Log de Acesso
    await prisma.accessLog.create({
      data: {
        tenantId,
        wifiUserId: user.id,
        macAddress: mac,
        userAgent: req.headers['user-agent']
      }
    });

    // 3. Redirecionar para liberar o acesso
    // Intelbras AP 360 espera POST para itbcaptive.cgi
    
    if (loginUrl) {
       console.log('Enviando POST para liberação:', loginUrl);
       
       // Renderiza uma página que faz o POST automático
       return res.send(`
         <html>
           <head><title>Autenticando...</title></head>
           <body onload="document.getElementById('loginForm').submit()">
             <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
               <p>Autenticando, aguarde...</p>
             </div>
             <form id="loginForm" action="${loginUrl}" method="POST">
               <input type="hidden" name="username" value="${mac}">
               <input type="hidden" name="password" value="guest">
             </form>
           </body>
         </html>
       `);
    }
    
    // Fallback: mostrar tela de sucesso
    res.render('portal-success', { originalUrl: originalUrl || 'https://google.com' });

  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao processar login.');
  }
});

module.exports = router;

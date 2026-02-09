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

  const { mac, ip, url, login_url, gw_address, gw_port, continue: continueUrl, ap_mac, ssid, redirect_uri, user_hash, ts } = req.query; 

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
      user_hash, // Passando user_hash para a view (Obrigatório para Intelbras)
      ts,        // Passando timestamp para a view
      originalUrl: url || continueUrl, 
      loginUrl: login_url || redirect_uri,
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
  const { mac, email, cpf, whatsapp, loginUrl, originalUrl, ip, user_hash, ts } = req.body;

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

    // 3. Redirecionar para liberar o acesso (MÉTODO INTELBRAS - Conforme documentação Zeus OS)
    // Usar GET redirect para o redirect_uri original com parâmetros na query string
    
    if (loginUrl) {
       console.log('=== LIBERAÇÃO INTELBRAS ===');
       console.log('redirect_uri original:', loginUrl);
       console.log('user_hash:', user_hash);
       console.log('ts:', ts);
       
       // Construir parâmetros conforme especificação (página 8-9 do PDF)
       const session_timeout = 3600;  // 1 hora
       const idle_timeout = 600;      // 10 min ocioso
       const continueUrl = originalUrl || 'http://www.google.com';
       
       // Construir URL final com parâmetros (GET redirect, não POST)
       const params = new URLSearchParams({
         continue: continueUrl,
         ts: ts,
         user_hash: user_hash,
         session_timeout: session_timeout.toString(),
         idle_timeout: idle_timeout.toString()
       });
       
       // Usar o redirect_uri ORIGINAL - NÃO reescrever para IP local!
       // O DNS meucaptive.intelbras.com.br resolve para o IP do roteador na rede do cliente
       const finalUrl = `${loginUrl}?${params.toString()}`;
       
       console.log('URL final de liberação:', finalUrl);
       console.log('===========================');
       
       // Redirect GET conforme documentação Intelbras
       return res.redirect(finalUrl);
     }
    
    // Fallback: mostrar tela de sucesso
    res.render('portal-success', { originalUrl: originalUrl || 'https://google.com' });

  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao processar login.');
  }
});

module.exports = router;

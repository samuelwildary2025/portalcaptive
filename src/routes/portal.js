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
  const { mac, email, cpf, whatsapp, loginUrl, originalUrl, ip } = req.body;

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
       let finalLoginUrl = loginUrl;
       const ip = req.body.ip;
       
       // TENTATIVA DE CORREÇÃO DE DNS E SSL:
       // Se tivermos o IP do gateway, vamos forçar o uso dele e HTTP puro.
       // O AP envia 'ip' na query string (ex: 10.0.0.1).
       
       if (ip) {
           // Substitui qualquer protocolo e domínio pelo IP do gateway em HTTP
           // Ex: https://meucaptive.intelbras.com.br:2061/... -> http://10.0.0.1:2061/...
           
           try {
               // Tenta fazer parse da URL original para manter path e query
               const urlObj = new URL(loginUrl);
               
               // Se a URL original for HTTPS, mudamos para HTTP para evitar erro de certificado auto-assinado
               const protocol = 'http:';
               
               // Mantém a porta se existir, senão usa padrão (mas o AP costuma mandar 2061)
               const port = urlObj.port ? `:${urlObj.port}` : '';
               
               // Reconstrói a URL usando o IP
               finalLoginUrl = `${protocol}//${ip}${port}${urlObj.pathname}${urlObj.search}`;
               
               console.log('URL de liberação reescrita (DNS/SSL Fix):', finalLoginUrl);
           } catch (e) {
               console.error('Erro ao reescrever URL:', e);
               // Se der erro no parse, mantém a original
           }
       }
       
       console.log('Enviando POST para liberação:', finalLoginUrl);
       
       // Renderiza uma página que faz o POST automático, mas com botão de fallback
       return res.send(`
         <html>
           <head>
             <title>Conectando...</title>
             <meta name="viewport" content="width=device-width, initial-scale=1.0">
             <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100vh; background: #f4f4f4; }
                .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; font-size: 16px; cursor: pointer; margin-top: 20px; }
             </style>
           </head>
           <body onload="setTimeout(function() { document.getElementById('loginForm').submit(); }, 1000)">
             <div class="loader"></div>
             <h3>Quase lá...</h3>
             <p>Finalizando sua conexão.</p>
             
             <form id="loginForm" action="${finalLoginUrl}" method="POST">
               <input type="hidden" name="username" value="${mac}">
               <input type="hidden" name="password" value="guest">
             </form>
             
             <p><small>Se não conectar em 5 segundos, clique abaixo:</small></p>
             <button onclick="document.getElementById('loginForm').submit()">LIBERAR INTERNET</button>
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

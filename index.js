import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import express from 'express';
import { guardarRecordatorio, obtenerRecordatorios, eliminarRecordatorio } from './utils/db.js';
import { programarRecordatorio, cancelarTodosLosRecordatorios } from './utils/scheduler.js';

// ============================================
// CONFIGURACIÓN DE EXPRESS
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Variables globales para estado del bot
let qrCodeData = null;
let botStatus = 'Iniciando...';
let isReady = false;

// Ruta principal - Muestra QR o estado del bot
app.get('/', (req, res) => {
    if (isReady) {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Tusi Bot - Estado</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        padding: 40px;
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                    }
                    .status-icon {
                        font-size: 80px;
                        margin-bottom: 20px;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                    }
                    h1 {
                        color: #2c3e50;
                        margin-bottom: 15px;
                        font-size: 28px;
                    }
                    .status {
                        color: #27ae60;
                        font-size: 20px;
                        font-weight: 600;
                        margin-bottom: 20px;
                    }
                    .info {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin-top: 20px;
                    }
                    .info p {
                        color: #666;
                        line-height: 1.6;
                        margin: 10px 0;
                    }
                    .badge {
                        display: inline-block;
                        background: #27ae60;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="status-icon">✅</div>
                    <h1>Tusi Bot</h1>
                    <p class="status">Bot conectado correctamente a WhatsApp</p>
                    <div class="info">
                        <p><strong>Estado:</strong> Activo y funcionando</p>
                        <p><strong>Proyecto:</strong> Sistema de Recordatorios Educativos</p>
                        <p><strong>Integrantes:</strong> Miguel Zaña, Jesus Albuquerque</p>
                        <p><strong>Profesor:</strong> Miguel Velez</p>
                        <div class="badge">🤖 Online</div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeData) {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Tusi Bot - Escanear QR</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        padding: 40px;
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                    }
                    h1 {
                        color: #2c3e50;
                        margin-bottom: 15px;
                        font-size: 28px;
                    }
                    .instructions {
                        color: #666;
                        margin-bottom: 25px;
                        line-height: 1.6;
                    }
                    .qr-container {
                        background: white;
                        padding: 20px;
                        border-radius: 15px;
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        margin: 20px 0;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                    }
                    .steps {
                        text-align: left;
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin-top: 20px;
                    }
                    .steps ol {
                        margin-left: 20px;
                        color: #555;
                    }
                    .steps li {
                        margin: 10px 0;
                        line-height: 1.5;
                    }
                    .refresh-notice {
                        margin-top: 20px;
                        color: #7f8c8d;
                        font-size: 14px;
                    }
                    .loading {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        border: 3px solid #667eea;
                        border-radius: 50%;
                        border-top-color: transparent;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
                <script>
                    // Auto-refresh cada 5 segundos para verificar si ya está conectado
                    setTimeout(() => {
                        location.reload();
                    }, 5000);
                </script>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 Tusi Bot</h1>
                    <p class="instructions">
                        <strong>Escanea este código QR con WhatsApp</strong><br>
                        para vincular el bot a tu cuenta
                    </p>
                    <div class="qr-container">
                        <img src="${qrCodeData}" alt="QR Code" />
                    </div>
                    <div class="steps">
                        <strong>📱 Pasos para vincular:</strong>
                        <ol>
                            <li>Abre WhatsApp en tu teléfono</li>
                            <li>Toca en <strong>Menú</strong> o <strong>Configuración</strong></li>
                            <li>Selecciona <strong>Dispositivos vinculados</strong></li>
                            <li>Toca en <strong>Vincular un dispositivo</strong></li>
                            <li>Escanea este código QR con tu cámara</li>
                        </ol>
                    </div>
                    <p class="refresh-notice">
                        <span class="loading"></span>
                        Esta página se actualizará automáticamente...
                    </p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Tusi Bot - Iniciando</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        padding: 40px;
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                    }
                    .loader {
                        width: 60px;
                        height: 60px;
                        border: 6px solid #f3f3f3;
                        border-top: 6px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 30px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    h1 {
                        color: #2c3e50;
                        margin-bottom: 15px;
                    }
                    p {
                        color: #666;
                        font-size: 16px;
                    }
                </style>
                <script>
                    setTimeout(() => location.reload(), 3000);
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="loader"></div>
                    <h1>🤖 Tusi Bot</h1>
                    <p>${botStatus}</p>
                    <p style="margin-top: 20px; font-size: 14px; color: #999;">
                        Espera un momento mientras iniciamos el bot...
                    </p>
                </div>
            </body>
            </html>
        `);
    }
});

// Iniciar servidor Express
app.listen(PORT, () => {
    console.log(`🌐 Servidor web ejecutándose en puerto ${PORT}`);
    console.log(`🔗 Accede desde: http://localhost:${PORT}`);
});

// ============================================
// CONFIGURACIÓN DE WHATSAPP CLIENT
// ============================================

// Crear cliente de WhatsApp con autenticación local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "tusibot",
        dataPath: "./auth"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Evento: Generar código QR para vincular WhatsApp
client.on('qr', async (qr) => {
    console.log('📱 Código QR generado');
    botStatus = 'Esperando escaneo del código QR...';
    
    try {
        // Convertir QR a imagen PNG en base64
        qrCodeData = await qrcode.toDataURL(qr);
        console.log('✅ QR disponible en la página web');
    } catch (error) {
        console.error('❌ Error al generar QR:', error);
    }
});

// Evento: Cliente listo y conectado
client.on('ready', () => {
    console.log('✅ Tusi Bot está listo y conectado!');
    botStatus = 'Bot conectado correctamente';
    isReady = true;
    qrCodeData = null; // Limpiar QR cuando esté conectado
    
    console.log('🔔 Cargando recordatorios programados...');
    
    // Cargar todos los recordatorios existentes al iniciar
    const recordatorios = obtenerRecordatorios();
    recordatorios.forEach(recordatorio => {
        programarRecordatorio(recordatorio, client);
    });
    
    console.log(`✅ ${recordatorios.length} recordatorio(s) programado(s)`);
});

// Evento: Procesar mensajes recibidos
client.on('message', async (message) => {
    const texto = message.body.trim();
    
    // Comando: !info
    if (texto === '!info') {
        await manejarComandoInfo(message);
    }
    
    // Comando: !recordar
    else if (texto.startsWith('!recordar ')) {
        await manejarComandoRecordar(message, texto);
    }
    
    // Comando: !ver recordatorios
    else if (texto === '!ver recordatorios') {
        await manejarComandoVer(message);
    }
    
    // Comando: !eliminar
    else if (texto.startsWith('!eliminar ')) {
        await manejarComandoEliminar(message, texto);
    }
});

// Maneja el comando !info
async function manejarComandoInfo(message) {
    const infoMensaje = `🤖 *Tusi Bot - Asistente de Recordatorios*

📚 *Sobre el Proyecto:*
Tusi Bot es un proyecto de innovación educativa diseñado para facilitar la organización y gestión de tareas académicas en grupos de estudio.

👥 *Integrantes del Proyecto:*
• Miguel Zaña
• Jesus Albuquerque

👨‍🏫 *Profesor:*
• Miguel Velez

⚙️ *Comandos Disponibles:*

1️⃣ *!recordar* <descripción> <dd/mm/yyyy> <hh:mm(am|pm)>
   Crea un recordatorio automático.
   Ejemplo: !recordar examen inglés 20/10/2025 6:00pm

2️⃣ *!ver recordatorios*
   Muestra todos los recordatorios activos.

3️⃣ *!eliminar* <número>
   Elimina un recordatorio de la lista.
   Ejemplo: !eliminar 1

4️⃣ *!info*
   Muestra esta información.

💡 *Funcionalidad:*
El bot enviará automáticamente un mensaje en la fecha y hora programadas para recordarte tus tareas, exámenes y actividades importantes.

🎯 ¡Tu organización académica, simplificada!`;

    await message.reply(infoMensaje);
}

// Maneja el comando !recordar
async function manejarComandoRecordar(message, texto) {
    try {
        // Extraer partes del comando usando regex
        const regex = /!recordar\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})(am|pm)/i;
        const match = texto.match(regex);
        
        if (!match) {
            await message.reply('❌ Formato incorrecto.\n\n✅ Usa: !recordar <descripción> <dd/mm/yyyy> <hh:mm(am|pm)>\n\nEjemplo: !recordar examen inglés 20/10/2025 6:00pm');
            return;
        }
        
        const [, descripcion, fecha, hora, periodo] = match;
        
        // Parsear fecha y hora
        const [dia, mes, año] = fecha.split('/').map(Number);
        let [horas, minutos] = hora.split(':').map(Number);
        
        // Convertir a formato 24 horas
        if (periodo.toLowerCase() === 'pm' && horas !== 12) {
            horas += 12;
        } else if (periodo.toLowerCase() === 'am' && horas === 12) {
            horas = 0;
        }
        
        // Crear objeto Date
        const fechaRecordatorio = new Date(año, mes - 1, dia, horas, minutos);
        
        // Validar que la fecha sea futura
        if (fechaRecordatorio <= new Date()) {
            await message.reply('❌ La fecha y hora deben ser futuras.');
            return;
        }
        
        // Crear objeto recordatorio
        const recordatorio = {
            id: Date.now(),
            descripcion,
            fecha: fecha,
            hora: `${hora}${periodo}`,
            fechaCompleta: fechaRecordatorio.toISOString(),
            chatId: message.from,
            activo: true
        };
        
        // Guardar en base de datos
        guardarRecordatorio(recordatorio);
        
        // Programar el recordatorio
        programarRecordatorio(recordatorio, client);
        
        await message.reply(`✅ Recordatorio guardado: ${descripcion} - ${fecha} ${hora}${periodo}`);
        
    } catch (error) {
        console.error('Error al crear recordatorio:', error);
        await message.reply('❌ Error al crear el recordatorio. Verifica el formato.');
    }
}

// Maneja el comando !ver recordatorios
async function manejarComandoVer(message) {
    const recordatorios = obtenerRecordatorios().filter(r => r.chatId === message.from && r.activo);
    
    if (recordatorios.length === 0) {
        await message.reply('📭 No hay recordatorios activos en este chat.');
        return;
    }
    
    let respuesta = '📋 *Recordatorios activos:*\n\n';
    recordatorios.forEach((r, index) => {
        respuesta += `${index + 1}. ${r.descripcion}\n`;
        respuesta += `   📅 ${r.fecha} - ${r.hora}\n\n`;
    });
    
    await message.reply(respuesta);
}

// Maneja el comando !eliminar
async function manejarComandoEliminar(message, texto) {
    try {
        const numero = parseInt(texto.replace('!eliminar', '').trim());
        
        if (isNaN(numero) || numero < 1) {
            await message.reply('❌ Indica el número del recordatorio.\n\nEjemplo: !eliminar 1');
            return;
        }
        
        const recordatorios = obtenerRecordatorios().filter(r => r.chatId === message.from && r.activo);
        
        if (numero > recordatorios.length) {
            await message.reply(`❌ No existe el recordatorio #${numero}. Usa !ver recordatorios para ver la lista.`);
            return;
        }
        
        const recordatorio = recordatorios[numero - 1];
        eliminarRecordatorio(recordatorio.id);
        
        await message.reply(`🗑️ Recordatorio eliminado: ${recordatorio.descripcion}`);
        
    } catch (error) {
        console.error('Error al eliminar recordatorio:', error);
        await message.reply('❌ Error al eliminar el recordatorio.');
    }
}

// Evento: Desconexión del cliente
client.on('disconnected', (reason) => {
    console.log('❌ Cliente desconectado:', reason);
    isReady = false;
    qrCodeData = null;
    botStatus = 'Desconectado';
    cancelarTodosLosRecordatorios();
});

// Inicializar el cliente
console.log('🚀 Iniciando Tusi Bot...');
botStatus = 'Iniciando cliente de WhatsApp...';
client.initialize();

// Manejo de cierre del proceso
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando Tusi Bot...');
    cancelarTodosLosRecordatorios();
    client.destroy();
    process.exit(0);
});
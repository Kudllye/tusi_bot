// 📦 Importar dependencias principales
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import unzipper from 'unzipper';
import fetch from 'node-fetch';
import { guardarRecordatorio, obtenerRecordatorios, eliminarRecordatorio } from './utils/db.js';
import { programarRecordatorio, cancelarTodosLosRecordatorios } from './utils/scheduler.js';

// 🌐 Función para restaurar la sesión desde un archivo remoto ZIP
async function restoreSession() {
    const url = process.env.AUTH_URL; // 🔐 Variable de entorno en Railway
    const localPath = './auth.zip';

    // Si no existe la carpeta .wwebjs_auth, intentamos restaurarla
    if (!fs.existsSync('./.wwebjs_auth')) {
        if (url) {
            try {
                console.log('🌐 Descargando sesión desde:', url);
                const res = await fetch(url);
                const fileStream = fs.createWriteStream(localPath);
                await new Promise((resolve, reject) => {
                    res.body.pipe(fileStream);
                    res.body.on('error', reject);
                    fileStream.on('finish', resolve);
                });

                // Descomprimir auth.zip
                await fs.createReadStream(localPath)
                    .pipe(unzipper.Extract({ path: './' }))
                    .promise();

                console.log('✅ Sesión restaurada correctamente.');
            } catch (error) {
                console.error('❌ Error al restaurar sesión:', error);
            }
        } else {
            console.log('⚠️ No se encontró AUTH_URL, se pedirá escanear QR.');
        }
    } else {
        console.log('💾 Sesión existente detectada.');
    }
}

// 🧩 Función principal
async function iniciarBot() {
    await restoreSession();

    // Crear cliente de WhatsApp con autenticación local
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: "tusibot"
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Evento: Generar código QR si no hay sesión guardada
    client.on('qr', (qr) => {
        console.log('📱 Escanea este código QR con WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    // Evento: Cliente listo y conectado
    client.on('ready', () => {
        console.log('✅ Tusi Bot está listo y conectado!');
        console.log('🔔 Cargando recordatorios programados...');

        const recordatorios = obtenerRecordatorios();
        recordatorios.forEach(recordatorio => {
            programarRecordatorio(recordatorio, client);
        });

        console.log(`✅ ${recordatorios.length} recordatorio(s) programado(s)`);
    });

    // Evento: Procesar mensajes recibidos
    client.on('message', async (message) => {
        const texto = message.body.trim();

        if (texto === '!info') {
            await manejarComandoInfo(message);
        } else if (texto.startsWith('!recordar ')) {
            await manejarComandoRecordar(message, texto);
        } else if (texto === '!ver recordatorios') {
            await manejarComandoVer(message);
        } else if (texto.startsWith('!eliminar ')) {
            await manejarComandoEliminar(message, texto);
        }
    });

    // Evento: Desconexión del cliente
    client.on('disconnected', (reason) => {
        console.log('❌ Cliente desconectado:', reason);
        cancelarTodosLosRecordatorios();
    });

    // Inicializar cliente
    console.log('🚀 Iniciando Tusi Bot...');
    client.initialize();

    // Cierre del proceso
    process.on('SIGINT', () => {
        console.log('\n👋 Cerrando Tusi Bot...');
        cancelarTodosLosRecordatorios();
        client.destroy();
        process.exit(0);
    });
}

// 🔧 Comandos
async function manejarComandoInfo(message) {
    const infoMensaje = `🤖 *Tusi Bot - Asistente de Recordatorios*

📚 *Sobre el Proyecto:*
Tusi Bot es un proyecto educativo diseñado para facilitar la organización de tareas académicas en grupos de estudio.

👥 *Integrantes del Proyecto:*
• Miguel Zaña
• Jesús Albuquerque

👨‍🏫 *Profesor:*
• Miguel Vélez

⚙️ *Comandos Disponibles:*
1️⃣ *!recordar* <descripción> <dd/mm/yyyy> <hh:mm(am|pm)>
   Ejemplo: !recordar examen inglés 20/10/2025 6:00pm

2️⃣ *!ver recordatorios*
   Muestra todos los recordatorios activos.

3️⃣ *!eliminar* <número>
   Elimina un recordatorio de la lista.

4️⃣ *!info*
   Muestra esta información.

💡 *Funcionalidad:*
El bot enviará automáticamente mensajes recordatorios en la fecha y hora programadas.

🎯 ¡Tu organización académica, simplificada!`;

    await message.reply(infoMensaje);
}

async function manejarComandoRecordar(message, texto) {
    try {
        const regex = /!recordar\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})(am|pm)/i;
        const match = texto.match(regex);

        if (!match) {
            await message.reply('❌ Formato incorrecto.\n\n✅ Usa: !recordar <descripción> <dd/mm/yyyy> <hh:mm(am|pm)>\n\nEjemplo: !recordar examen inglés 20/10/2025 6:00pm');
            return;
        }

        const [, descripcion, fecha, hora, periodo] = match;
        const [dia, mes, año] = fecha.split('/').map(Number);
        let [horas, minutos] = hora.split(':').map(Number);

        if (periodo.toLowerCase() === 'pm' && horas !== 12) horas += 12;
        else if (periodo.toLowerCase() === 'am' && horas === 12) horas = 0;

        const fechaRecordatorio = new Date(año, mes - 1, dia, horas, minutos);
        if (fechaRecordatorio <= new Date()) {
            await message.reply('❌ La fecha y hora deben ser futuras.');
            return;
        }

        const recordatorio = {
            id: Date.now(),
            descripcion,
            fecha,
            hora: `${hora}${periodo}`,
            fechaCompleta: fechaRecordatorio.toISOString(),
            chatId: message.from,
            activo: true
        };

        guardarRecordatorio(recordatorio);
        programarRecordatorio(recordatorio, client);

        await message.reply(`✅ Recordatorio guardado: ${descripcion} - ${fecha} ${hora}${periodo}`);
    } catch (error) {
        console.error('Error al crear recordatorio:', error);
        await message.reply('❌ Error al crear el recordatorio. Verifica el formato.');
    }
}

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

// 🚀 Ejecutar el bot
iniciarBot();

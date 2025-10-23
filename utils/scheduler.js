import schedule from 'node-schedule';
import { marcarRecordatorioEnviado } from './db.js';

// Almacena las tareas programadas para poder cancelarlas
const tareasActivas = new Map();

// Programar un recordatorio
export function programarRecordatorio(recordatorio, client) {
    // No programar si ya fue enviado o está inactivo
    if (!recordatorio.activo || recordatorio.enviado) {
        return;
    }
    
    const fechaRecordatorio = new Date(recordatorio.fechaCompleta);
    
    // Validar que la fecha sea futura
    if (fechaRecordatorio <= new Date()) {
        console.log(`⏭️ Recordatorio pasado, no se programa: ${recordatorio.descripcion}`);
        return;
    }
    
    // Programar tarea
    const job = schedule.scheduleJob(fechaRecordatorio, async () => {
        try {
            // Enviar mensaje al chat
            const mensaje = `📌 *Recordatorio de Tusi Bot:* ${recordatorio.descripcion}\n🕗 Fecha: ${recordatorio.fecha} - ${recordatorio.hora}`;
            
            await client.sendMessage(recordatorio.chatId, mensaje);
            
            console.log(`✅ Recordatorio enviado: ${recordatorio.descripcion}`);
            
            // Marcar como enviado en la base de datos
            marcarRecordatorioEnviado(recordatorio.id);
            
            // Eliminar de tareas activas
            tareasActivas.delete(recordatorio.id);
            
        } catch (error) {
            console.error(`❌ Error al enviar recordatorio ${recordatorio.id}:`, error);
        }
    });
    
    // Guardar referencia de la tarea
    tareasActivas.set(recordatorio.id, job);
    
    console.log(`⏰ Recordatorio programado: ${recordatorio.descripcion} para ${recordatorio.fecha} ${recordatorio.hora}`);
}

// Cancelar un recordatorio específico
export function cancelarRecordatorio(id) {
    const job = tareasActivas.get(id);
    if (job) {
        job.cancel();
        tareasActivas.delete(id);
        console.log(`❌ Tarea cancelada: ${id}`);
    }
}

// Cancelar todos los recordatorios programados
export function cancelarTodosLosRecordatorios() {
    tareasActivas.forEach((job, id) => {
        job.cancel();
        console.log(`❌ Tarea cancelada: ${id}`);
    });
    tareasActivas.clear();
    console.log('🛑 Todas las tareas programadas han sido canceladas');
}
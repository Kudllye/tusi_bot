import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

// Inicializar base de datos si no existe
function inicializarDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ recordatorios: [] }, null, 2));
    }
}

// Leer base de datos
function leerDB() {
    inicializarDB();
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
}

// Escribir en base de datos
function escribirDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Guardar un nuevo recordatorio
export function guardarRecordatorio(recordatorio) {
    const db = leerDB();
    db.recordatorios.push(recordatorio);
    escribirDB(db);
    console.log(`✅ Recordatorio guardado: ${recordatorio.descripcion}`);
}

// Obtener todos los recordatorios
export function obtenerRecordatorios() {
    const db = leerDB();
    return db.recordatorios;
}

// Eliminar un recordatorio por ID
export function eliminarRecordatorio(id) {
    const db = leerDB();
    const recordatorio = db.recordatorios.find(r => r.id === id);
    
    if (recordatorio) {
        recordatorio.activo = false;
        escribirDB(db);
        console.log(`🗑️ Recordatorio eliminado: ${recordatorio.descripcion}`);
        return true;
    }
    
    return false;
}

// Marcar recordatorio como enviado
export function marcarRecordatorioEnviado(id) {
    const db = leerDB();
    const recordatorio = db.recordatorios.find(r => r.id === id);
    
    if (recordatorio) {
        recordatorio.activo = false;
        recordatorio.enviado = true;
        escribirDB(db);
    }
}
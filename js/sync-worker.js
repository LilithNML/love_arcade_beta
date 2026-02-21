/**
 * sync-worker.js — Love Arcade v7.5
 * Web Worker responsable de la codificación/decodificación Base64
 * y del cálculo de checksums SHA-256 para la sincronización de partidas.
 * Ejecuta operaciones pesadas en un hilo separado para no bloquear la UI.
 */

/**
 * Calcula el hash SHA-256 de un texto dado.
 * @param {string} text
 * @returns {Promise<string>} Hash hexadecimal de 64 caracteres.
 */
async function computeHash(text) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Codifica el store a Base64 con checksum de integridad.
 * @param {object} store Estado completo del usuario.
 * @param {string} salt  Salt secreto para el hash.
 * @returns {Promise<string>} Código exportable.
 */
async function exportStore(store, salt) {
    const json     = JSON.stringify(store);
    const checksum = await computeHash(json + salt);
    const payload  = JSON.stringify({ data: store, checksum });
    // encodeURIComponent → unescape para soporte Unicode en btoa
    return btoa(unescape(encodeURIComponent(payload)));
}

/**
 * Decodifica un código de exportación y valida su integridad.
 * @param {string} code Código importado por el usuario.
 * @param {string} salt Salt secreto para verificar el hash.
 * @returns {Promise<{data: object, valid: boolean}>}
 */
async function importStore(code, salt) {
    const json    = decodeURIComponent(escape(atob(code.trim())));
    const payload = JSON.parse(json);

    // Compatibilidad con partidas antiguas (v7.2 y anteriores)
    // que no incluían campo checksum.
    if (!payload.checksum || !payload.data) {
        // Formato legado: el JSON era directamente el store
        const legacyStore = payload;
        if (typeof legacyStore.coins !== 'number') {
            throw new Error('Formato inválido');
        }
        return { data: legacyStore, valid: true, legacy: true };
    }

    const expected = await computeHash(JSON.stringify(payload.data) + salt);
    return {
        data:   payload.data,
        valid:  payload.checksum === expected,
        legacy: false
    };
}

// ── Receptor de mensajes ──────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
    const { id, action, ...data } = e.data;

    try {
        if (action === 'export') {
            const result = await exportStore(data.store, data.salt);
            self.postMessage({ id, result });

        } else if (action === 'import') {
            const result = await importStore(data.code, data.salt);
            self.postMessage({ id, result });

        } else {
            self.postMessage({ id, error: `Acción desconocida: ${action}` });
        }
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
});

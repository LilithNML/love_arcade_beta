export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        // CAMBIO: Subimos la recompensa base de 1 a 2
        this.baseReward = 2; 
    }

    calculateCoins(score) {
    // AJUSTE ELITE 1: Umbral reducido. 
    // Ahora el jugador empieza a ganar monedas mucho antes (a los 15 puntos).
    if (score <= 15) return 0; 
    
    // AJUSTE ELITE 2: Multiplicador agresivo de 2.5 (antes 0.45).
    // Esto hace que la progresión se sienta mucho más satisfactoria.
    // Ejemplo: 10,639 pts -> sqrt(10639) * 2.5 = 257.8 monedas.
    const raw = Math.sqrt(score) * 2.5;
    
    // AJUSTE ELITE 3: Soft Cap extendido a 500.
    // Evitamos que los puntajes altos se estanquen prematuramente.
    const performanceCoins = Math.min(raw, 500);

    // Sumamos la baseReward (2) al cálculo de rendimiento.
    let total = this.baseReward + Math.floor(performanceCoins);
    
    // AJUSTE ELITE 4: Cap Global de Seguridad aumentado a 1000.
    // Elevamos el techo para permitir premios legendarios en partidas perfectas.
    return Math.min(total, 1000); 
}


    payout(score) {
        const coins = this.calculateCoins(score);

        // --- VALIDACIONES DEL SISTEMA UNIVERSAL ---
        
        // 1. Verificar existencia del GameCenter (Love Arcade Core)
        if (!window.GameCenter) {
            console.warn('[Dodger] Love Arcade no detectado (Modo Offline). Monedas calculadas: ' + coins);
            return { sent: false, coins: coins };
        }

        // 2. No enviar transacciones de 0 o negativas
        if (coins <= 0) return { sent: false, coins: 0 };

        // 3. Generar ID único por sesión (Idempotencia)
        const levelId = `session_${Date.now()}`;

        try {
         // 4. Ejecutar transacción
            window.GameCenter.completeLevel(this.gameId, levelId, coins);
            console.log(`[Dodger] Payout exitoso: ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (error) {
            console.error('[Dodger] Error enviando monedas:', error);
            return { sent: false, coins: 0 };
        }
    }
}

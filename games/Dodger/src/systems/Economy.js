export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        // CAMBIO: Subimos la recompensa base de 1 a 2
        this.baseReward = 2; 
    }

    calculateCoins(score) {
    // CAMBIO: Umbral más bajo (de 30 a 15) para premiar partidas rápidas
    if (score <= 15) return 0; 
    
    // CAMBIO: Factor 0.85 (antes 0.45) para que las monedas suban rápido
    const raw = Math.sqrt(score) * 0.85;
    
    // CAMBIO: Aumentamos el Soft Cap de 60 a 85 monedas
    const performanceCoins = Math.min(raw, 85);

    let total = this.baseReward + Math.floor(performanceCoins);
    
    // Cap Global: Lo subimos a 150
    return Math.min(total, 150); 
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

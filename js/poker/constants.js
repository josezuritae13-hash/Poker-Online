export const DEFAULT_CONFIG = {
    maxPlayers: 6,
    smallBlind: 10,
    bigBlind: 20,
    chips: {
        black: { label: 'Negras', value: 100, bank: 30, perPlayer: 10 },
        white: { label: 'Blancas', value: 50, bank: 15, perPlayer: 5 },
        red: { label: 'Rojas', value: 25, bank: 40, perPlayer: 10 },
        blue: { label: 'Azules', value: 10, bank: 30, perPlayer: 5 },
        green: { label: 'Verdes', value: 5, bank: 30, perPlayer: 5 }
    }
};

export const CHIP_KEYS = ['black', 'white', 'red', 'blue', 'green'];
export const PHASE_LABELS = {
    preflop: 'Pre-flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
    gameover: 'Partida terminada'
};

export function normalizeConfig(raw = {}) {
    const config = {
        ...DEFAULT_CONFIG,
        ...raw,
        chips: { ...DEFAULT_CONFIG.chips, ...(raw.chips || {}) }
    };
    config.maxPlayers = clampInt(config.maxPlayers, 2, 6, 6);
    config.smallBlind = clampInt(config.smallBlind, 1, 1_000_000, 10);
    config.bigBlind = clampInt(config.bigBlind, config.smallBlind * 2, 2_000_000, 20);
    for (const key of CHIP_KEYS) {
        const src = config.chips[key] || DEFAULT_CONFIG.chips[key];
        config.chips[key] = {
            label: DEFAULT_CONFIG.chips[key].label,
            value: clampInt(src.value, 1, 1_000_000, DEFAULT_CONFIG.chips[key].value),
            bank: clampInt(src.bank, 0, 10_000, DEFAULT_CONFIG.chips[key].bank),
            perPlayer: clampInt(src.perPlayer, 0, 10_000, DEFAULT_CONFIG.chips[key].perPlayer)
        };
    }
    return config;
}

export function startingStack(config) {
    return CHIP_KEYS.reduce((sum, key) => sum + config.chips[key].value * config.chips[key].perPlayer, 0);
}

export function validateConfig(config, playerCount) {
    const cfg = normalizeConfig(config);
    const errors = [];
    if (playerCount < 2) errors.push('Necesitas al menos 2 jugadores.');
    if (playerCount > cfg.maxPlayers) errors.push(`La sala permite como máximo ${cfg.maxPlayers} jugadores.`);
    if (cfg.bigBlind < cfg.smallBlind * 2) errors.push('La Big Blind debe ser al menos el doble de la Small Blind.');
    if (startingStack(cfg) <= 0) errors.push('Las fichas por jugador deben tener un valor total mayor que 0.');
    if (startingStack(cfg) < cfg.bigBlind * 10) errors.push('La pila inicial es demasiado pequeña para una partida estable.');
    if (playerCount > 0) {
        for (const key of CHIP_KEYS) {
            const needed = cfg.chips[key].perPlayer * playerCount;
            if (needed > cfg.chips[key].bank) {
                errors.push(`${cfg.chips[key].label}: no hay suficientes fichas del banco para todos los jugadores.`);
            }
        }
    }
    return { valid: errors.length === 0, errors, config: cfg, startingStack: startingStack(cfg) };
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

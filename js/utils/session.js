const SessionManager = {
    KEY: 'poker_session',
    generatePlayerId() {
        return crypto.randomUUID?.() || `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    },
    get() {
        try {
            const raw = sessionStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
    create(playerName) {
        const session = {
            playerId: this.generatePlayerId(),
            playerName: String(playerName || '').trim().slice(0, 20),
            roomCode: null,
            createdAt: Date.now()
        };
        sessionStorage.setItem(this.KEY, JSON.stringify(session));
        return session;
    },
    update(patch) {
        const current = this.get();
        if (!current) return null;
        const next = { ...current, ...patch };
        sessionStorage.setItem(this.KEY, JSON.stringify(next));
        return next;
    },
    clear() {
        sessionStorage.removeItem(this.KEY);
    }
};

export { SessionManager };

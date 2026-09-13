import { ref, get, set, update, remove, onValue, onDisconnect, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { db } from './config.js';

const ROOT = 'rooms';

export const FirebaseDatabase = {
    db,
    roomRef(code) { return ref(db, `${ROOT}/${code}`); },
    gameRef(code) { return ref(db, `${ROOT}/${code}/game`); },
    playerRef(code, id) { return ref(db, `${ROOT}/${code}/players/${id}`); },

    async getRoom(code) {
        const snap = await get(this.roomRef(code));
        return snap.exists() ? snap.val() : null;
    },

    onRoom(code, callback) {
        return onValue(this.roomRef(code), snap => callback(snap.exists() ? snap.val() : null));
    },

    onGame(code, callback) {
        return onValue(this.gameRef(code), snap => callback(snap.exists() ? snap.val() : null));
    },

    async createRoom(code, playerId, playerName, config) {
        const result = await runTransaction(this.roomRef(code), current => {
            if (current !== null) return;
            return {
                code,
                hostId: playerId,
                status: 'waiting',
                createdAt: Date.now(),
                expiresAt: Date.now() + 6 * 60 * 60 * 1000,
                maxPlayers: config.maxPlayers,
                config,
                players: {
                    [playerId]: {
                        id: playerId,
                        name: playerName,
                        connected: true,
                        joinedAt: Date.now()
                    }
                }
            };
        });
        if (!result.committed) throw new Error('No se pudo crear la sala. Intenta de nuevo.');
    },

    async joinRoom(code, playerId, playerName) {
        console.log('🔎 Intentando entrar a sala:', code);

        const room = await this.getRoom(code);

        console.log('📦 Sala encontrada:', room);

        if (!room) {
            throw new Error(`La sala ${code} no existe.`);
        }

        if (room.status !== 'waiting') {
            throw new Error(`La sala ya comenzó. Estado: ${room.status}`);
        }

        if (Number(room.expiresAt || 0) < Date.now()) {
            throw new Error('La sala ha expirado.');
        }

        const players = { ...(room.players || {}) };

        const maxPlayers = Math.min(
            6,
            Math.max(2, Number(room.maxPlayers) || 6)
        );

        const playerCount = Object.keys(players).length;

        console.log('👥 Jugadores:', playerCount, '/', maxPlayers);

        if (playerCount >= maxPlayers) {
            throw new Error('La sala está llena.');
        }

        if (players[playerId]) {
            throw new Error('Este jugador ya está en la sala.');
        }

        players[playerId] = {
            id: playerId,
            name: playerName,
            connected: true,
            joinedAt: Date.now()
        };

        await update(
            this.roomRef(code),
            {
                players
            }
        );

        console.log('✅ Jugador agregado correctamente:', playerName);
    },

    async updateRoom(code, patch) {
        await update(this.roomRef(code), patch);
    },

    async removeRoom(code) {
        await remove(this.roomRef(code));
    },

    async transactionGame(code, updater) {
        return runTransaction(this.gameRef(code), current => updater(current));
    },

    setupPresence(code, playerId) {
        const player = this.playerRef(code, playerId);
        let armed = false;
        const connectedRef = ref(db, '.info/connected');
        const unsubscribe = onValue(connectedRef, async snap => {
            if (snap.val() !== true || armed) return;
            armed = true;
            try {
                await onDisconnect(player).update({ connected: false, lastSeen: serverTimestamp() });
                await update(player, { connected: true, lastSeen: serverTimestamp() });
            } catch (error) {
                console.error('Presence error:', error);
            }
        });
        return unsubscribe;
    },

    async leaveRoom(code, playerId) {
        const room = await this.getRoom(code);
        if (!room?.players?.[playerId]) return;
        const players = { ...(room.players || {}) };
        delete players[playerId];
        if (!Object.keys(players).length) {
            await this.removeRoom(code);
            return;
        }

        const patch = { [`players/${playerId}`]: null };
        if (room.hostId === playerId) {
            const nextHost = Object.values(players).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
            patch.hostId = nextHost.id;
        }
        await update(this.roomRef(code), patch);
    },

    async bestEffortCleanupExpired(code) {
        const room = await this.getRoom(code);
        if (room && Number(room.expiresAt || 0) < Date.now()) await this.removeRoom(code);
    }
};

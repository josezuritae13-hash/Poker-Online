import { FirebaseDatabase } from './database.js';
import { RoomCodeGenerator } from '../utils/roomCode.js';
import { SessionManager } from '../utils/session.js';
import { DEFAULT_CONFIG, normalizeConfig, validateConfig } from '../poker/constants.js';

export const FirebaseRoom = {
    async create(playerName, config = DEFAULT_CONFIG) {
        const name = cleanName(playerName);
        const normalized = normalizeConfig(config);
        for (let attempt = 0; attempt < 15; attempt++) {
            const code = RoomCodeGenerator.generate();
            const session = SessionManager.create(name);
            try {
                await FirebaseDatabase.createRoom(code, session.playerId, name, normalized);
                SessionManager.update({ roomCode: code });
                FirebaseDatabase.setupPresence(code, session.playerId);
                return { roomCode: code, playerId: session.playerId, isHost: true };
            } catch (error) {
                SessionManager.clear();
                if (attempt === 14) throw error;
            }
        }
        throw new Error('No se pudo generar una sala.');
    },

    async join(code, playerName) {
        const roomCode = RoomCodeGenerator.normalize(code);
        const name = cleanName(playerName);
        if (!RoomCodeGenerator.isValid(roomCode)) throw new Error('Código de sala inválido.');
        const session = SessionManager.create(name);
        try {
            await FirebaseDatabase.joinRoom(roomCode, session.playerId, name);
            SessionManager.update({ roomCode });
            FirebaseDatabase.setupPresence(roomCode, session.playerId);
            return { roomCode, playerId: session.playerId, isHost: false };
        } catch (error) {
            SessionManager.clear();
            throw error;
        }
    },

    async saveConfig(roomCode, playerId, config) {
        const room = await FirebaseDatabase.getRoom(roomCode);
        if (!room) throw new Error('La sala ya no existe.');
        if (room.hostId !== playerId) throw new Error('Solo el host puede cambiar la configuración.');
        if (room.status !== 'waiting') throw new Error('La configuración ya está bloqueada.');
        await FirebaseDatabase.updateRoom(roomCode, { config: normalizeConfig(config), maxPlayers: normalizeConfig(config).maxPlayers });
    },

    async start(roomCode, playerId) {
        const room = await FirebaseDatabase.getRoom(roomCode);
        if (!room) throw new Error('Sala no encontrada.');
        if (room.hostId !== playerId) throw new Error('Solo el host puede iniciar la partida.');
        if (room.status !== 'waiting') throw new Error('La partida ya fue iniciada.');
        const count = Object.keys(room.players || {}).length;
        const check = validateConfig(room.config, count);
        if (!check.valid) throw new Error(check.errors[0]);
        await FirebaseDatabase.updateRoom(roomCode, { status: 'starting', config: check.config, maxPlayers: check.config.maxPlayers });
    },

    async leave(roomCode, playerId) {
        await FirebaseDatabase.leaveRoom(roomCode, playerId);
        SessionManager.clear();
    }
};

function cleanName(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
    if (name.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres.');
    return name;
}

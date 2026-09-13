import { FirebaseDatabase } from './firebase/database.js';
import { FirebaseRoom } from './firebase/room.js';
import { SessionManager } from './utils/session.js';
import { DEFAULT_CONFIG, normalizeConfig, validateConfig, CHIP_KEYS, startingStack } from './poker/constants.js';

const $ = id => document.getElementById(id);

class LobbyController {
    constructor() {
        this.session = SessionManager.get();
        const query = new URLSearchParams(location.search);
        this.roomCode = query.get('code')?.toUpperCase();
        this.playerId = query.get('player') || this.session?.playerId;
        this.room = null;
        this.unsubscribe = null;
        this.presenceUnsubscribe = null;
        this.saving = false;
        this.starting = false;
        this.configDraft = normalizeConfig(DEFAULT_CONFIG);
        this.configDirty = false;
        this.bound = false;
        this.init();
    }

    async init() {
        if (!this.session || !this.roomCode || this.session.roomCode !== this.roomCode || this.session.playerId !== this.playerId) {
            return location.replace('../index.html');
        }
        this.bindEvents();
        $('roomCodeDisplay').textContent = this.roomCode;
        this.presenceUnsubscribe = FirebaseDatabase.setupPresence(this.roomCode, this.playerId);
        this.unsubscribe = FirebaseDatabase.onRoom(this.roomCode, room => this.handleRoom(room));
        window.addEventListener('beforeunload', () => this.presenceUnsubscribe?.());
    }

    bindEvents() {
        if (this.bound) return;
        this.bound = true;
        $('exitBtn').addEventListener('click', () => this.exit());
        $('copyBtn').addEventListener('click', () => this.copyCode());
        $('saveConfigBtn').addEventListener('click', () => this.saveConfig());
        $('startBtn').addEventListener('click', () => this.start());
        for (const key of CHIP_KEYS) {
            for (const suffix of ['Value', 'Bank', 'PerPlayer']) $(key + suffix).addEventListener('input', () => { this.configDirty = true; this.updateConfigPreview(); });
        }
        for (const id of ['maxPlayers', 'smallBlind', 'bigBlind']) $(id).addEventListener('input', () => { this.configDirty = true; this.updateConfigPreview(); });
    }

    handleRoom(room) {
        if (!room) {
            this.toast('La sala ya no existe.');
            SessionManager.clear();
            return location.replace('../index.html');
        }
        this.room = room;
        FirebaseDatabase.bestEffortCleanupExpired(this.roomCode).catch(() => {});
        $('roomCodeDisplay').textContent = this.roomCode;

        const players = Object.values(room.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        const maxPlayers = Number(room.maxPlayers || 6);
        $('playerCount').textContent = `${players.length}/${maxPlayers}`;
        this.renderPlayers(players, room);
        this.renderConfig(room.config, room.hostId === this.playerId);

        if (room.status === 'starting' || room.status === 'playing') {
            $('startBtn').disabled = true;
            $('startBtn').textContent = 'Entrando a la mesa…';
            setTimeout(() => location.replace(`game.html?code=${encodeURIComponent(this.roomCode)}&player=${encodeURIComponent(this.playerId)}`), 120);
            return;
        }

        const isHost = room.hostId === this.playerId;
        const count = players.length;
        const canStart = isHost && count >= 2 && !this.starting;
        $('startBtn').disabled = !canStart;
        $('startBtn').textContent = isHost ? (count < 2 ? `Faltan ${2 - count} jugador${count === 1 ? '' : 'es'}` : 'Empezar partida') : 'Esperando al host…';
        $('startTitle').textContent = count < 2 ? 'Esperando jugadores' : (isHost ? 'Todo listo' : 'Esperando al host');
        $('startHelp').textContent = count < 2 ? 'Comparte el código de la sala con tus amigos.' : (isHost ? 'Revisa la configuración y comienza cuando quieras.' : 'El host controla las reglas y las fichas iniciales.');
        $('statusMessage').textContent = count < 2 ? 'La partida necesita al menos 2 jugadores.' : `${count} jugadores conectados. ${isHost ? 'Puedes iniciar cuando la configuración sea válida.' : 'La sala está lista.'}`;
    }

    renderPlayers(players, room) {
        const list = $('playersList');
        list.innerHTML = players.map((p, index) => {
            const isHost = p.id === room.hostId;
            const isMe = p.id === this.playerId;
            const status = p.connected === false ? 'Desconectado' : 'Conectado';
            return `<article class="player-item ${isHost ? 'host' : ''}" style="--delay:${index * 45}ms">
                <div class="player-avatar">${escapeHtml((p.name || '?')[0].toUpperCase())}</div>
                <div class="player-info"><strong>${escapeHtml(p.name || 'Jugador')} ${isMe ? '<small>· Tú</small>' : ''}</strong><span>${status}</span></div>
                ${isHost ? '<span class="host-badge">HOST</span>' : ''}
            </article>`;
        }).join('');
    }

    renderConfig(rawConfig, editable) {
        const cfg = normalizeConfig(rawConfig || DEFAULT_CONFIG);
        this.configDraft = cfg;
        editable = !!editable;
        if (editable && this.configDirty) return;
        const ids = ['maxPlayers', 'smallBlind', 'bigBlind'];
        $('maxPlayers').value = String(cfg.maxPlayers);
        $('smallBlind').value = cfg.smallBlind;
        $('bigBlind').value = cfg.bigBlind;
        for (const key of CHIP_KEYS) {
            $(key + 'Value').value = cfg.chips[key].value;
            $(key + 'Bank').value = cfg.chips[key].bank;
            $(key + 'PerPlayer').value = cfg.chips[key].perPlayer;
        }
        for (const id of ['maxPlayers', 'smallBlind', 'bigBlind', ...CHIP_KEYS.flatMap(k => [k + 'Value', k + 'Bank', k + 'PerPlayer'])]) $(id).disabled = !editable;
        $('saveConfigBtn').classList.toggle('hidden', !editable);
        $('hostOnlyMessage').classList.toggle('hidden', editable);
        $('hostLock').textContent = editable ? 'HOST · EDITABLE' : 'SOLO LECTURA';
        updateStackValue(cfg);
    }

    readConfig() {
        const cfg = {
            maxPlayers: Number($('maxPlayers').value),
            smallBlind: Number($('smallBlind').value),
            bigBlind: Number($('bigBlind').value),
            chips: {}
        };
        for (const key of CHIP_KEYS) cfg.chips[key] = {
            label: this.configDraft.chips[key].label,
            value: Number($(key + 'Value').value),
            bank: Number($(key + 'Bank').value),
            perPlayer: Number($(key + 'PerPlayer').value)
        };
        return normalizeConfig(cfg);
    }

    updateConfigPreview() {
        const cfg = this.readConfig();
        updateStackValue(cfg);
        const count = Object.keys(this.room?.players || {}).length;
        const check = validateConfig(cfg, count || 2);
        $('configError').classList.toggle('hidden', check.valid);
        $('configError').innerHTML = check.valid ? '' : check.errors.map(e => `<div>• ${escapeHtml(e)}</div>`).join('');
    }

    async saveConfig() {
        if (this.saving || this.room?.hostId !== this.playerId) return;
        this.saving = true;
        try {
            const cfg = this.readConfig();
            const count = Object.keys(this.room.players || {}).length;
            const check = validateConfig(cfg, count || 2);
            if (!check.valid) throw new Error(check.errors[0]);
            await FirebaseRoom.saveConfig(this.roomCode, this.playerId, check.config);
            this.configDirty = false;
            this.toast('Configuración guardada.');
        } catch (error) {
            $('configError').classList.remove('hidden');
            $('configError').textContent = error.message || 'No se pudo guardar la configuración.';
        } finally {
            this.saving = false;
        }
    }

    async start() {
        if (this.starting) return;
        this.starting = true;
        $('startBtn').disabled = true;
        try {
            const cfg = this.readConfig();
            const count = Object.keys(this.room?.players || {}).length;
            const check = validateConfig(cfg, count);
            if (!check.valid) throw new Error(check.errors[0]);
            await FirebaseRoom.saveConfig(this.roomCode, this.playerId, check.config);
            this.configDirty = false;
            await FirebaseRoom.start(this.roomCode, this.playerId);
        } catch (error) {
            this.starting = false;
            this.toast(error.message || 'No se pudo iniciar.', true);
            this.handleRoom(this.room);
        }
    }

    async copyCode() {
        try { await navigator.clipboard.writeText(this.roomCode); this.toast('Código copiado.'); }
        catch { this.toast(`Código: ${this.roomCode}`); }
    }

    async exit() {
        if (!confirm('¿Salir de esta sala? Las fichas son temporales y se perderán al salir.')) return;
        try { await FirebaseRoom.leave(this.roomCode, this.playerId); }
        catch (error) { this.toast(error.message || 'No se pudo salir.', true); }
        finally { location.replace('../index.html'); }
    }

    toast(message, error = false) {
        const el = $('toast');
        el.textContent = message;
        el.className = `toast show ${error ? 'error' : ''}`;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.className = 'toast', 2600);
    }
}

function updateStackValue(config) {
    $('stackValue').textContent = `${startingStack(config).toLocaleString('en-US')} fichas por jugador`;
}
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\\': '&#92;', '"': '&quot;' }[c])); }
document.addEventListener('DOMContentLoaded', () => new LobbyController());

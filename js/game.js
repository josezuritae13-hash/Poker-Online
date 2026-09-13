import { FirebaseDatabase } from './firebase/database.js';
import { FirebaseRoom } from './firebase/room.js';
import { SessionManager } from './utils/session.js';
import { PHASE_LABELS, normalizeConfig } from './poker/constants.js';
import { createInitialGame, startNewHand, applyAction, prepareNewHand, handlePlayerLeave, validateStartedState } from './poker/engine.js';
import { SUIT_SYMBOLS } from './poker/deck.js';
import { getCardImage } from './poker/cardImages.js';

const $ = id => document.getElementById(id);

class GameController {
    constructor() {
        this.session = SessionManager.get();
        const query = new URLSearchParams(location.search);
        this.roomCode = query.get('code')?.toUpperCase();
        this.playerId = query.get('player') || this.session?.playerId;
        this.roomUnsub = null;
        this.gameUnsub = null;
        this.presenceUnsub = null;
        this.busy = false;
        this.cleanTimer = null;
        this.lastPhase = null;
        this.lastMessage = null;
        this.init();
    }

    async init() {
        if (!this.session || this.session.roomCode !== this.roomCode || this.session.playerId !== this.playerId) return location.replace('../index.html');
        $('roomLabel').textContent = `SALA ${this.roomCode}`;
        this.bind();
        this.presenceUnsub = FirebaseDatabase.setupPresence(this.roomCode, this.playerId);
        this.roomUnsub = FirebaseDatabase.onRoom(this.roomCode, room => this.handleRoom(room));
        this.gameUnsub = FirebaseDatabase.onGame(this.roomCode, game => this.handleGame(game));

        try {
            const room = await FirebaseDatabase.getRoom(this.roomCode);
            if (!room) throw new Error('La sala ya no existe.');
            await FirebaseDatabase.transactionGame(this.roomCode, current => {
                if (validateStartedState(current)) return current;
                const state = createInitialGame(room);
                state.players.forEach(p => { p.chips = getStartingStack(room.config); });
                return startNewHand(state);
            });
            await FirebaseDatabase.updateRoom(this.roomCode, { status: 'playing' });
        } catch (error) {
            this.toast(error.message || 'No se pudo preparar la mesa.', true);
            setTimeout(() => location.replace('../index.html'), 1600);
        }
    }

    bind() {
        $('foldBtn').addEventListener('click', () => this.action('fold'));
        $('checkBtn').addEventListener('click', () => this.action('check'));
        $('callBtn').addEventListener('click', () => this.action('call'));
        $('allInBtn').addEventListener('click', () => this.action('allin'));
        $('raiseBtn').addEventListener('click', () => this.action('raise', $('raiseAmount').value));
        $('newHandBtn').addEventListener('click', () => this.newHand());
        $('backBtn').addEventListener('click', () => this.leave());
        $('raiseAmount').addEventListener('keydown', e => { if (e.key === 'Enter') $('raiseBtn').click(); });
    }

    handleRoom(room) {
        if (!room) {
            SessionManager.clear();
            return location.replace('../index.html');
        }
        if (room.status === 'waiting') return location.replace(`lobby.html?code=${encodeURIComponent(this.roomCode)}&player=${encodeURIComponent(this.playerId)}`);
    }

    handleGame(state) {
        if (!state) return;
        if (!state.players?.some(p => p.id === this.playerId)) return;
        this.render(state);
        if (state.phase === 'gameover' && state.finishedAt) this.scheduleCleanup();
    }

    render(state) {
        const me = this.player(state);
        const myTurn = state.currentPlayerId === this.playerId;
        $('phase').textContent = PHASE_LABELS[state.phase] || 'Preparando';
        $('pot').textContent = formatNumber(state.pot);
        $('chips').textContent = formatNumber(me?.chips || 0);
        $('myName').textContent = me?.name || this.session.playerName;
        $('communityCards').innerHTML = (state.community || []).map(renderCard).join('');
        $('myCards').innerHTML = (state.privateHands?.[this.playerId] || []).map(renderCard).join('');
        $('playersTable').innerHTML = (state.players || []).map((p, index) => renderPlayer(p, state, this.playerId, index)).join('');
        $('turnLabel').textContent = myTurn ? 'TU TURNO' : (state.phase === 'showdown' ? 'SHOWDOWN' : 'ESPERANDO');
        $('turnLabel').classList.toggle('active', myTurn);
        $('message').textContent = state.winnerText || state.message || (myTurn ? 'Elige una acción.' : `Turno de ${this.player(state.currentPlayerId)?.name || 'otro jugador'}.`);
        const call = Math.max(0, (state.currentBet || 0) - (me?.roundBet || 0));
        $('callAmount').textContent = call ? formatNumber(call) : '';
        this.setControls(state, myTurn, me);
        $('newHandBtn').classList.toggle('hidden', state.phase !== 'showdown');
        if (state.phase !== this.lastPhase) document.body.classList.remove('phase-flash'), void document.body.offsetWidth, document.body.classList.add('phase-flash');
        if (state.message && state.message !== this.lastMessage && state.message.includes('se ')) this.toast(state.message);
        this.lastPhase = state.phase;
        this.lastMessage = state.message;
    }

    setControls(state, myTurn, me) {
        const active = myTurn && me && !me.folded && !me.left && me.chips > 0 && ['preflop','flop','turn','river'].includes(state.phase);
        const ids = ['foldBtn','checkBtn','callBtn','raiseBtn','allInBtn'];
        ids.forEach(id => $(id).disabled = !active);
        const call = Math.max(0, (state.currentBet || 0) - (me?.roundBet || 0));
        $('checkBtn').disabled = !active || call !== 0;
        $('callBtn').disabled = !active || call === 0;
        $('raiseAmount').disabled = !active || me.chips <= 0;
        $('raiseBtn').disabled = !active || me.chips <= 0;
        if (active) {
            const min = Math.max(state.currentBet + state.lastRaise, state.currentBet + 1);
            $('raiseAmount').min = String(min);
            $('raiseAmount').max = String(me.roundBet + me.chips);
            if (Number($('raiseAmount').value) < min) $('raiseAmount').value = min;
        }
    }

    async action(action, amount = 0) {
        if (this.busy) return;
        this.busy = true;
        try {
            let failure = null;
            const result = await FirebaseDatabase.transactionGame(this.roomCode, state => {
                if (!state) return state;
                const outcome = applyAction(state, this.playerId, action, amount);
                if (!outcome.ok) failure = outcome.reason;
                return state;
            });
            if (failure) this.toast(failure, true);
            if (!result?.committed) this.toast('La acción no pudo confirmarse.', true);
        } catch (error) {
            this.toast(error.message || 'Error de conexión.', true);
        } finally { this.busy = false; }
    }

    async newHand() {
        if (this.busy) return;
        this.busy = true;
        try {
            let failure = null;
            const result = await FirebaseDatabase.transactionGame(this.roomCode, state => {
                if (!state || state.phase !== 'showdown') return state;
                if (state.players.find(p => p.id === this.playerId)?.left) { failure = 'Ya no estás en la mesa.'; return state; }
                return prepareNewHand(state);
            });
            if (failure) this.toast(failure, true);
            if (result?.committed && result.snapshot?.val()?.phase === 'gameover') this.scheduleCleanup();
        } catch (error) { this.toast(error.message || 'No se pudo iniciar la nueva mano.', true); }
        finally { this.busy = false; }
    }

    async leave() {
        if (!confirm('¿Salir de la partida? Tus fichas son temporales y no se guardarán.')) return;
        try {
            await FirebaseDatabase.transactionGame(this.roomCode, state => {
                if (!state) return state;
                handlePlayerLeave(state, this.playerId);
                return state;
            });
            await FirebaseRoom.leave(this.roomCode, this.playerId);
        } catch (error) { this.toast(error.message || 'No se pudo salir.', true); }
        finally { SessionManager.clear(); location.replace('../index.html'); }
    }

    scheduleCleanup() {
        if (this.cleanTimer) return;
        this.cleanTimer = setTimeout(async () => {
            try { await FirebaseDatabase.removeRoom(this.roomCode); }
            catch {}
            finally { SessionManager.clear(); location.replace('../index.html'); }
        }, 8000);
    }

    player(state, id = this.playerId) { return state?.players?.find(p => p.id === id); }
    toast(message, error = false) {
        const el = $('toast');
        el.textContent = message;
        el.className = `toast show ${error ? 'error' : ''}`;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.className = 'toast', 2400);
    }
}

function getStartingStack(rawConfig) {
    const cfg = normalizeConfig(rawConfig);
    return Object.values(cfg.chips).reduce((sum, chip) => sum + chip.value * chip.perPlayer, 0);
}
function formatNumber(value) { return Number(value || 0).toLocaleString('en-US'); }
function renderCard(card) {
    const image = getCardImage(card);

    if (image) {
        return `
            <div class="card">
                <img src="${image}" alt="${card}">
            </div>
        `;
    }

    const rank = card?.[0] === 'T' ? '10' : card?.[0] || '?';
    const suit = SUIT_SYMBOLS[card?.[1]] || '';
    const red = card?.[1] === 'H' || card?.[1] === 'D';

    return `
        <div class="card ${red ? 'red' : 'black'}">
            <span>${rank}</span>
            <span>${suit}</span>
        </div>
    `;
}
function renderPlayer(p, state, myId, index) {
    const classes = [
        'table-player',
        p.id === myId ? 'me' : '',
        p.folded || p.left ? 'folded' : '',
        p.id === state.currentPlayerId ? 'is-turn' : ''
    ].filter(Boolean).join(' ');
    const badge = p.isDealer ? '<em class="dealer-mark">D</em>' : '';
    const status = p.left ? 'Salió' : p.folded ? 'Fold' : p.allIn ? 'ALL-IN' : `${formatNumber(p.chips)} fichas`;
    return `<article class="${classes}" style="--i:${index}"><div class="avatar">${escapeHtml((p.name || '?')[0].toUpperCase())}</div><div class="player-copy"><strong>${escapeHtml(p.name || 'Jugador')}${p.id === myId ? ' · Tú' : ''}</strong><span>${status}</span></div>${badge}</article>`;
}
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\\': '&#92;', '"': '&quot;' }[c])); }
document.addEventListener('DOMContentLoaded', () => new GameController());

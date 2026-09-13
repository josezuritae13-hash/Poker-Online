import { FirebaseRoom } from './firebase/room.js';
import { SessionManager } from './utils/session.js';
import { RoomCodeGenerator } from './utils/roomCode.js';

const $ = id => document.getElementById(id);

async function main() {
    const existing = SessionManager.get();
    if (existing?.roomCode) return location.href = `pages/lobby.html?code=${encodeURIComponent(existing.roomCode)}&player=${encodeURIComponent(existing.playerId)}`;
    if (existing) SessionManager.clear();

    $('createBtn').addEventListener('click', async () => {
        const name = $('playerName').value.trim();
        if (name.length < 2) return setFormError('createError', 'Escribe un nombre de al menos 2 caracteres.');
        busy('createBtn', true, 'Creando sala…');
        try {
            const result = await FirebaseRoom.create(name);
            location.href = `pages/lobby.html?code=${encodeURIComponent(result.roomCode)}&player=${encodeURIComponent(result.playerId)}`;
        } catch (error) {
            setFormError('createError', error.message || 'No se pudo crear la sala.');
            busy('createBtn', false, 'Crear sala');
        }
    });
    $('joinBtn').addEventListener('click', () => { $('entrySection').classList.add('hidden'); $('joinSection').classList.remove('hidden'); $('roomCode').focus(); });
    $('backBtn').addEventListener('click', () => { $('joinSection').classList.add('hidden'); $('entrySection').classList.remove('hidden'); $('joinError').classList.add('hidden'); $('playerName').focus(); });
    $('roomCode').addEventListener('input', e => e.target.value = RoomCodeGenerator.normalize(e.target.value));
    $('confirmJoinBtn').addEventListener('click', async () => {
        const code = RoomCodeGenerator.normalize($('roomCode').value);
        const name = $('joinPlayerName').value.trim();
        if (!RoomCodeGenerator.isValid(code)) return setFormError('joinError', 'El código debe tener 5 caracteres.');
        if (name.length < 2) return setFormError('joinError', 'Escribe un nombre de al menos 2 caracteres.');
        busy('confirmJoinBtn', true, 'Entrando…');
        try {
            const result = await FirebaseRoom.join(code, name);
            location.href = `pages/lobby.html?code=${encodeURIComponent(result.roomCode)}&player=${encodeURIComponent(result.playerId)}`;
        } catch (error) {
            setFormError('joinError', error.message || 'No se pudo entrar a la sala.');
            busy('confirmJoinBtn', false, 'Entrar a la sala');
        }
    });
    for (const [id, action] of [['playerName','create'], ['joinPlayerName','join'], ['roomCode','join']]) {
        $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $(action === 'create' ? 'createBtn' : 'confirmJoinBtn').click(); });
    }
}
function busy(id, yes, text) { const el = $(id); el.disabled = yes; el.textContent = text; }
function setFormError(id, text) { const el = $(id); el.textContent = text; el.classList.remove('hidden'); }

document.addEventListener('DOMContentLoaded', main);

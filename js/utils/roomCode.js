const RoomCodeGenerator = {
    CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    generate() {
        return Array.from({ length: 5 }, () => this.CHARS[Math.floor(Math.random() * this.CHARS.length)]).join('');
    },
    normalize(code) {
        return String(code || '').toUpperCase().replace(/\s+/g, '').slice(0, 5);
    },
    isValid(code) {
        return /^[A-HJ-NP-Z2-9]{5}$/.test(this.normalize(code));
    }
};

export { RoomCodeGenerator };

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { setup } = require('../src/macos-shortcuts');

function harness() {
    const webContents = new EventEmitter();
    const menu = [];
    let quits = 0;
    webContents.setIgnoreMenuShortcuts = value => menu.push(value);
    setup(webContents, { quit: () => quits++ });
    const press = (extra = {}) => {
        const event = { preventDefault() { this.prevented = true; } };
        webContents.emit('before-input-event', event, { type: 'keyDown', key: 'q', meta: true, ...extra });
        return event;
    };
    return { webContents, menu, press, quits: () => quits };
}

test('Command-Q consumes the event and requests orderly app.quit', () => {
    const h = harness();
    assert.equal(h.press({ key: 'Q' }).prevented, true);
    assert.equal(h.quits(), 1);
    assert.deepEqual(h.menu, [false]);
});
test('repeated Command-Q is consumed without requesting quit again', () => {
    const h = harness();
    h.press();
    assert.equal(h.press({ isAutoRepeat: true }).prevented, true);
    assert.equal(h.quits(), 1);
});
test('keyup, other keys and extra modifiers do not quit or consume input', () => {
    for (const extra of [{ type: 'keyUp' }, { meta: false }, { control: true },
        { alt: true }, { shift: true }, { key: 'w' }, { key: undefined }]) {
        const h = harness();
        assert.equal(h.press(extra).prevented, undefined);
        assert.equal(h.quits(), 0);
    }
});
test('copy chords defer to renderer, other chords and blur restore menu shortcuts', () => {
    const h = harness();
    for (const shift of [false, true]) {
        assert.equal(h.press({ key: 'c', shift }).prevented, undefined);
        assert.equal(h.menu.at(-1), true);
    }
    for (const extra of [{ key: 'c', control: true }, { key: 'c', alt: true },
        { key: 'c', meta: false }, { key: 'v' }]) {
        h.press(extra);
        assert.equal(h.menu.at(-1), false);
    }
    h.press({ key: 'c' });
    h.webContents.emit('blur');
    assert.equal(h.menu.at(-1), false);
    assert.equal(h.quits(), 0);
});

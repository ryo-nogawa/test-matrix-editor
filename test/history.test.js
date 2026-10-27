// 元に戻す・やり直し（要件定義書 5.10）
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/core/history.js');

test('元に戻す・やり直し', () => {
  let h = H.create('A');
  h = H.push(h, 'B');
  h = H.push(h, 'C');
  h = H.undo(h);
  assert.equal(h.present, 'B');
  h = H.undo(h);
  assert.equal(h.present, 'A');
  assert.equal(H.canUndo(h), false);
  h = H.redo(h);
  assert.equal(h.present, 'B');
  assert.equal(H.canRedo(h), true);
});

test('戻した後に新しい操作をすると、やり直しの履歴は消える', () => {
  let h = H.push(H.push(H.create('A'), 'B'), 'C');
  h = H.push(H.undo(h), 'D');
  assert.equal(h.present, 'D');
  assert.equal(H.canRedo(h), false);
  assert.equal(H.undo(h).present, 'B');
});

test('戻せない・やり直せないときは何もしない', () => {
  const h = H.create('A');
  assert.equal(H.undo(h), h);
  assert.equal(H.redo(h), h);
});

test('データが変わらない操作は記録しない', () => {
  const h = H.create('A');
  assert.equal(H.push(h, 'A'), h);
});

test('履歴は上限の数まで残し、古いものから消す', () => {
  let h = H.create(0, 3);
  for (let i = 1; i <= 5; i++) h = H.push(h, i);
  assert.deepEqual(h.past, [2, 3, 4]);
});

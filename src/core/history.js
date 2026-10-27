// 元に戻す・やり直し。操作のたびに「操作後のデータ」を積み重ねる
//
// データは操作のたびに新しく作られる（matrix.js）ため、前の状態をそのまま取っておける。
// 変わっていない行は前の状態と共有されるので、履歴を持ってもメモリはあまり増えない
const History = (() => {
  const DEFAULT_LIMIT = 100;

  function create(present, limit = DEFAULT_LIMIT) {
    return { past: [], present, future: [], limit };
  }

  // 新しい操作を記録する。やり直しの履歴は消える。読み込みも1回の操作として記録する
  function push(history, next) {
    if (next === history.present) return history;
    const past = [...history.past, history.present].slice(-history.limit);
    return { ...history, past, present: next, future: [] };
  }

  function undo(history) {
    if (!canUndo(history)) return history;
    return {
      ...history,
      past: history.past.slice(0, -1),
      present: history.past[history.past.length - 1],
      future: [history.present, ...history.future],
    };
  }

  function redo(history) {
    if (!canRedo(history)) return history;
    return {
      ...history,
      past: [...history.past, history.present],
      present: history.future[0],
      future: history.future.slice(1),
    };
  }

  const canUndo = (history) => history.past.length > 0;
  const canRedo = (history) => history.future.length > 0;

  return { create, push, undo, redo, canUndo, canRedo };
})();

if (typeof module !== 'undefined') module.exports = History;

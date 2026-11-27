// Android back button: anything open on screen (sheets, map card) registers a close handler here.
// The most recent one is closed first; if nothing is open, the app navigates back a screen.
const stack = []
export function pushBack(fn) { stack.push(fn); return () => { const i = stack.lastIndexOf(fn); if (i >= 0) stack.splice(i, 1) } }
export function popBack() { const fn = stack.pop(); if (fn) { fn(); return true } return false }

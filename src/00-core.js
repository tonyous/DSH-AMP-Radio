window.__ModuleLoader__.load({
  id: 'dsh-amp-radio',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const h = React.createElement;

    // Always-available offline stations (no network needed).
    const AMP_VERSION = '2.2.5';
    const reported = new Set();
    function ampReport(where, err) {
      const key = where + ':' + String(err?.message || err).slice(0, 80);
      if (reported.has(key)) return; reported.add(key);
      try { console.warn('[amp-bar] ' + where + ':', err?.message || err); } catch {}
      try { fetch('/api/amp-bar/report', {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'},
        body: JSON.stringify({where, message: String(err?.message || err).slice(0, 300), version: AMP_VERSION})}).catch(() => {}); } catch {}
    }


    // Every DSH part this plugin relies on, in ONE place (2.1). A DSH update that renames one shows up in the problem
    // log and in the AMP Bar settings, instead of a switch that silently stops working. `need`: must exist on a chat
    // page (DSH ships it); the others are optional (another plugin or a DSH setting may leave them out).
    const DSH_PARTS = [
      {name: 'message box', sel: '[data-composer-card]', need: true},
      {name: 'stats row under the message box', sel: '[data-composer-card] + div', need: true},
      {name: 'DSH stats (turns, tokens)', sel: '[data-composer-stat]', need: true},
      {name: 'chat header buttons (Top position)', sel: '[class*="headerActions"]', need: true},
      {name: 'context ring', sel: 'button[aria-label$="of context used"]', need: false},
      {name: 'task panel (task timer fallback)', sel: '[data-testid=todo-panel]', need: false},
      {name: 'hardware stats plugin', sel: '[data-hardware-stats]', need: false},
    ];
    let dshMissing = [];
    const dshListeners = new Set();
    function checkDshParts() {
      if (!document.querySelector('[data-composer-card]')) return;            // not on a chat page: nothing to judge
      const missing = DSH_PARTS.filter(p => p.need && !document.querySelector(p.sel)).map(p => p.name);
      if (missing.join() !== dshMissing.join()) { dshMissing = missing; dshListeners.forEach(fn => { try { fn(); } catch {} }); }
      for (const m of missing) ampReport('dsh changed', 'not found: ' + m);
    }
    const useDshMissing = () => React.useSyncExternalStore(fn => { dshListeners.add(fn); return () => dshListeners.delete(fn); }, () => dshMissing, () => dshMissing);


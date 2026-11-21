    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'dsh-radio';
        style.textContent = css;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'dsh-radio: scoped styles');
      // Never let a missing/renamed dock slot break client boot: worst case
      // on an unknown DSH version is a missing radio button, never an error.
      try {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-radio', order: 20,
        }, RadioPill));
      } catch (e) {
        console.warn('[dsh-radio] composer dock unavailable, pill not mounted:', e?.message || e);
      }
      // AMP Bar: each piece is optional; a DSH without one of these slots just skips that piece.
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'amp-bar';
        style.textContent = barCss + statsCss + tasksCss + borrowCss;
        document.head.appendChild(style);
        barStyleEl = document.createElement('style');
        barStyleEl.dataset.plugin = 'amp-bar-switches';
        document.head.appendChild(barStyleEl);
        applyBarCss();
        loadBarSettings();
        const stop = startBarController();
        return () => { stop(); style.remove(); barStyleEl?.remove(); barStyleEl = null; };
      }, 'amp-bar: layout and switches');
      const slot = (name, opts, comp) => {
        try { ctx.slots.inject(name, () => ctx.slots.register({name, ...opts}, comp)); }
        catch (e) { console.warn('[amp-bar] ' + name + ' unavailable:', e?.message || e); }
      };
      slot('conversation.session.header.actions', {id: 'amp-bar-anchor', order: 1000}, BarAnchor);
      slot('conversation.composer.dock', {id: 'amp-borrow-banner', order: 5}, BorrowBanner);
      slot('conversation.composer.dock', {id: 'amp-tasks', order: 11}, AmpTasks);
      slot('conversation.composer.dock', {id: 'amp-stats', order: 12}, AmpStats);
      slot('conversation.composer.dock', {id: 'amp-dock-host', order: 30}, AmpDockHost);
      slot('settings.section', {id: 'amp-bar', order: 40, label: 'AMP Bar'}, () => h(BarSettings, null));
      ctx.effect(() => {
        let t = setTimeout(function run() { try { checkDshParts(); } catch (e) { ampReport('dsh check', e); } t = setTimeout(run, 60000); }, 15000);
        return () => clearTimeout(t);
      }, 'amp-bar: DSH parts self-check');
    }

    return {inject: ['slots'], apply, RadioPill, __test: {checkDshParts, getDshMissing: () => dshMissing, ttCompute}};
  },
});

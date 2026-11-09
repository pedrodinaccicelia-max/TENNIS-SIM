/*
 * Anúncios (Google AdSense) — Etapa 1.
 *
 * Banners fixos fora da área do jogo (não são recriados quando a tela muda,
 * então não há "refresh" de anúncio, que o AdSense proíbe):
 *   - topo: abaixo do cabeçalho, em todas as telas (728x90 no PC, 320x50 no celular);
 *   - laterais: 160x600 à esquerda e à direita, só em telas largas (>= 1440 px).
 * Um espaço só aparece depois que o Google preenche o anúncio; antes da aprovação
 * (ou com bloqueador de anúncios) nada aparece e o layout fica como antes.
 *
 * Pop-up (Ads.interstitial): tela cheia com botão de fechar, chamado pelo jogo
 * só em pausas (fim de carreira; no Trivia, a cada 3 torneios, sempre ANTES de
 * a próxima pergunta existir). Dois modos:
 *   - 'h5'   : H5 Games Ads do Google (adBreak). É o formato oficial do AdSense
 *              para jogos; precisa ser liberado pelo Google numa inscrição à parte.
 *   - 'modal': janela própria do jogo com um bloco de display 300x250.
 *
 * Para o futuro plano Pro: Ads.setPro(true) tira todos os anúncios.
 */
(function () {
  const CFG = {
    enabled: true,
    client: 'ca-pub-5296502740665093',
    slots: { top: '8111293768', left: '2723235710', right: '4927882179', popup: '4053784208' },
    popup: 'h5',          // 'h5' | 'modal' | 'off'
    triviaEvery: 3,       // Trivia: pop-up a cada N torneios
  };

  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const forced = /[?&]ads=1\b/.test(location.search);
  let pro = false;
  const on = () => CFG.enabled && !pro && (!local || forced);

  const push = () => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloqueador ou erro do script */ } };

  function slot(key, cls) {
    const box = document.createElement('div');
    box.className = `ad-slot ${cls}`;
    box.setAttribute('aria-label', 'Publicidade');
    box.innerHTML = `<span class="ad-label">Publicidade</span><ins class="adsbygoogle" data-ad-client="${CFG.client}" data-ad-slot="${CFG.slots[key]}"></ins>`;
    const ins = box.querySelector('ins');
    new MutationObserver(() => {
      const st = ins.getAttribute('data-ad-status');
      box.classList.toggle('is-filled', st === 'filled');
      if (cls.includes('ad-rail')) document.body.classList.toggle('rails-on', !!document.querySelector('.ad-rail.is-filled'));
    }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return box;
  }

  function mountBanners() {
    if (!on() || document.querySelector('.ad-slot')) return;
    const top = document.querySelector('header.top');
    if (!top) return;
    top.after(slot('top', 'ad-top'));
    push();
    if (matchMedia('(min-width: 1440px) and (min-height: 720px)').matches) {
      const l = slot('left', 'ad-rail ad-left'), r = slot('right', 'ad-rail ad-right');
      document.body.append(l, r);
      push(); push();
    }
  }

  // ---------- pop-up ----------
  let busy = false;

  function viaH5(name) {
    return new Promise(resolve => {
      let started = false, done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      // se o Google não responder (bloqueador, sem liberação), o jogo segue sozinho
      setTimeout(() => { if (!started) finish(); }, 1500);
      setTimeout(finish, 120000);
      try {
        window.adBreak({
          type: 'next', name,
          beforeAd: () => { started = true; },
          afterAd: () => {},
          adBreakDone: finish,
        });
      } catch (e) { finish(); }
    });
  }

  function viaModal() {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'ad-pop is-loading';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-label', 'Publicidade');
      wrap.innerHTML = `<div class="ad-pop-card">
          <div class="ad-pop-head"><span class="ad-label">Publicidade</span><button class="btn btn-primary ad-close" type="button">Fechar e continuar</button></div>
          <ins class="adsbygoogle" data-ad-client="${CFG.client}" data-ad-slot="${CFG.slots.popup}"></ins>
        </div>`;
      document.body.append(wrap);
      const ins = wrap.querySelector('ins');
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve();
      };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (!wrap.classList.contains('is-loading')) e.stopPropagation(); };
      document.addEventListener('keydown', onKey, true);
      wrap.querySelector('.ad-close').addEventListener('click', close);
      const t = setTimeout(close, 3500);           // não preencheu: segue o jogo sem mostrar nada
      new MutationObserver(() => {
        const st = ins.getAttribute('data-ad-status');
        if (st === 'filled') { clearTimeout(t); wrap.classList.remove('is-loading'); wrap.querySelector('.ad-close').focus({ preventScroll: true }); }
        else if (st === 'unfilled') { clearTimeout(t); close(); }
      }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
      push();
    });
  }

  // Mostra (talvez) um anúncio de tela cheia e resolve quando o jogador pode continuar.
  function interstitial(name) {
    // sem o script do Google carregado (bloqueador, sem internet), não há o que mostrar
    if (!on() || busy || CFG.popup === 'off' || !(window.adsbygoogle && window.adsbygoogle.loaded)) return Promise.resolve();
    busy = true;
    const p = CFG.popup === 'h5' ? viaH5(name) : viaModal();
    return p.then(() => { busy = false; });
  }

  function setPro(v) {
    pro = !!v;
    if (pro) { document.querySelectorAll('.ad-slot').forEach(e => e.remove()); document.body.classList.remove('rails-on'); }
    else mountBanners();
  }

  window.Ads = { interstitial, setPro, get busy() { return busy; }, triviaEvery: CFG.triviaEvery, config: CFG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBanners);
  else mountBanners();
})();

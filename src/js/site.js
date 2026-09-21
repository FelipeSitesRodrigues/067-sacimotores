// Saci Motores: comportamento da página. Sem biblioteca e sem ouvir o scroll:
// tudo que depende de rolagem vai por IntersectionObserver.
(() => {
  const doc = document
  const cab = doc.getElementById('cab')
  const botaoMenu = doc.querySelector('.cab__menu')
  const menu = doc.getElementById('menu-celular')
  const temIO = 'IntersectionObserver' in window

  // ---------------------------------------------------------------- menu do celular
  const fecharMenu = (devolverFoco) => {
    if (menu.hidden) return
    menu.hidden = true
    menu.classList.remove('abrindo')
    botaoMenu.setAttribute('aria-expanded', 'false')
    botaoMenu.setAttribute('aria-label', 'Abrir menu')
    if (devolverFoco) botaoMenu.focus()
  }
  const abrirMenu = () => {
    menu.hidden = false
    menu.classList.add('abrindo')
    botaoMenu.setAttribute('aria-expanded', 'true')
    botaoMenu.setAttribute('aria-label', 'Fechar menu')
    const primeiro = menu.querySelector('a')
    if (primeiro) primeiro.focus({ preventScroll: true })
  }
  botaoMenu.addEventListener('click', () => (menu.hidden ? abrirMenu() : fecharMenu(false)))
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) fecharMenu(false) })
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(true) })
  doc.addEventListener('click', (e) => { if (!menu.hidden && !cab.contains(e.target)) fecharMenu(false) })
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) fecharMenu(false) })

  // ---------------------------------------------------------------- Google (Analytics, Ads e Tag Manager)
  // IDs no site.config.json. Só liga no domínio de verdade, ou com ?tags na URL
  // pra testar: abrir o site no computador ou na prévia da Vercel e clicar no
  // WhatsApp não pode virar conversão falsa no Google Ads do cliente.
  // O script do Google baixa 2 s depois da página pronta, ou no primeiro toque,
  // o que vier antes: assim ele não disputa a abertura da página.
  const google = {
    ga: '{{cfg.google.analytics}}',
    ads: '{{cfg.google.ads}}',
    conversao: '{{cfg.google.conversaoWhatsapp}}',
    gtm: '{{cfg.google.tagManager}}',
  }
  const dominio = new URL('{{cfg.dominio}}').hostname.replace(/^www\./, '')
  const googleLigado = location.hostname.endsWith(dominio) || new URLSearchParams(location.search).has('tags')
  window.dataLayer = window.dataLayer || []
  const gtag = (window.gtag = function () { window.dataLayer.push(arguments) })
  let googleCarregado = false
  const carregarGoogle = () => {
    if (!googleLigado || googleCarregado) return
    googleCarregado = true
    gtag('js', new Date())
    gtag('config', google.ga)
    gtag('config', google.ads)
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    for (const src of [`https://www.googletagmanager.com/gtag/js?id=${google.ga}`, `https://www.googletagmanager.com/gtm.js?id=${google.gtm}`]) {
      const s = doc.createElement('script')
      s.async = true
      s.src = src
      doc.head.append(s)
    }
  }
  if (googleLigado) {
    const depois = () => setTimeout(carregarGoogle, 2000)
    if (doc.readyState === 'complete') depois()
    else addEventListener('load', depois, { once: true })
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, carregarGoogle, { once: true, passive: true })
  }

  // ---------------------------------------------------------------- rastreio dos cliques no WhatsApp
  // Cada clique vira conversão no Google Ads e evento no Analytics, e sai também
  // no dataLayer (Tag Manager) e no Pixel da Meta, se um dia for instalado.
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]')
    if (!a) return
    const origem = a.dataset.zap || a.closest('section')?.id || 'pagina'
    window.dataLayer.push({ event: 'whatsapp_click', origem })
    if (googleLigado) {
      carregarGoogle()
      gtag('event', 'conversion', { send_to: google.conversao })
      gtag('event', 'whatsapp_click', { send_to: google.ga, origem })
    }
    if (typeof window.fbq === 'function') window.fbq('track', 'Contact', { origem })
  })

  if (!temIO) {
    doc.querySelectorAll('[data-revela]').forEach((el) => el.classList.add('visivel'))
    doc.querySelector('.zap')?.classList.add('zap--on')
    return
  }

  // ---------------------------------------------------------------- sombra do cabeçalho
  // A barra do topo some da tela quando a página rola: aí o cabeçalho ganha sombra.
  const marco = doc.getElementById('barra')
  const hero = doc.getElementById('inicio')
  new IntersectionObserver(([e]) => cab.classList.toggle('rolou', !e.isIntersecting), {
    rootMargin: '-1px 0px 0px 0px',
  }).observe(marco && !matchMedia('(max-width: 767px)').matches ? marco : hero.querySelector('.hero__titulo'))

  // ---------------------------------------------------------------- link ativo do menu
  // Diferenciais não tem item no menu: enquanto ela está na tela, Serviços segue marcado.
  const links = [...doc.querySelectorAll('.cab__nav a, .menu-celular nav a')]
  const apelido = { diferenciais: 'servicos' }
  const marcar = (id) => {
    for (const a of links) {
      const ativo = a.getAttribute('href') === `#${id}`
      a.classList.toggle('ativo', ativo)
      if (ativo) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    }
  }
  const ioSecao = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) if (e.isIntersecting) marcar(apelido[e.target.id] || e.target.id)
    },
    { rootMargin: '-45% 0px -50% 0px' },
  )
  ;['inicio', 'empresa', 'produtos', 'servicos', 'diferenciais', 'contato']
    .map((id) => doc.getElementById(id))
    .filter(Boolean)
    .forEach((s) => ioSecao.observe(s))

  // ---------------------------------------------------------------- revelação no scroll
  const ioRevela = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue
        e.target.classList.add('visivel')
        ioRevela.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  )
  doc.querySelectorAll('[data-revela]').forEach((el) => ioRevela.observe(el))

  // ---------------------------------------------------------------- WhatsApp flutuante
  const zap = doc.querySelector('.zap')
  if (zap) {
    new IntersectionObserver(([e]) => zap.classList.toggle('zap--on', !e.isIntersecting), {
      rootMargin: '0px 0px -30% 0px',
    }).observe(hero)
  }
})()

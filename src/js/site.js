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

  // ---------------------------------------------------------------- rastreio dos cliques no WhatsApp
  // Evento no dataLayer (GA4 / Tag Manager) e no Pixel, se estiverem instalados.
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]')
    if (!a) return
    const origem = a.dataset.zap || a.closest('section')?.id || 'pagina'
    ;(window.dataLayer = window.dataLayer || []).push({ event: 'whatsapp_click', origem })
    if (typeof window.fbq === 'function') window.fbq('track', 'Contact', { origem })
  })
})()

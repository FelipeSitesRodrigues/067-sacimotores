/**
 * Confere se as tags do Google disparam, sem sujar os dados do cliente.
 *
 * Os scripts do Google (gtag.js e gtm.js) carregam de verdade, mas todo envio
 * de dado (Analytics, conversão do Google Ads) é bloqueado na rede e só fica
 * registrado aqui. Nenhuma visita ou conversão falsa chega na conta dele.
 *
 * - Em localhost, sem ?tags, o Google não pode nem carregar.
 * - Com ?tags (ou no domínio de verdade): carregam Analytics, Ads e Tag Manager,
 *   sai a visita (page_view) e o clique no WhatsApp vira conversão + evento.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar-tags.mjs
 *      BASE_URL=https://www.sacimotoreseletricos.com.br node scripts/testar-tags.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3067').replace(/\/$/, '')
const LOCAL = /^https?:\/\/(localhost|127\.)/.test(BASE)
const g = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8')).google
const [contaAds, rotulo] = g.conversaoWhatsapp.replace('AW-', '').split('/')
const NAVEGADOR = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

// tudo que manda dado pro Google, e o próprio WhatsApp (o clique não abre nada)
const BLOQUEAR = ['*/g/collect*', '*google-analytics.com*', '*analytics.google.com*', '*/pagead/*', '*doubleclick.net*', '*googleadservices.com*', '*/ccm/*', '*wa.me*', '*whatsapp.com*']
const ehEnvio = (u) => /\/g\/collect|google-analytics\.com|analytics\.google\.com|\/pagead\/|doubleclick\.net|googleadservices\.com|\/ccm\//.test(u)

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function abrir(browser, url) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const cdp = await page.createCDPSession()
  await cdp.send('Network.enable')
  await cdp.send('Network.setBlockedURLs', { urls: BLOQUEAR })
  const reqs = []
  const vazou = []
  page.on('request', (r) => reqs.push({ url: r.url(), corpo: r.postData() || '' }))
  page.on('requestfinished', (r) => { if (ehEnvio(r.url())) vazou.push(r.url()) })
  await page.goto(url, { waitUntil: 'load' })
  return { page, reqs, vazou }
}

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  if (LOCAL) {
    console.log('\nNo computador, sem ?tags: o Google fica desligado')
    const { page, reqs } = await abrir(browser, BASE + '/')
    await page.mouse.wheel({ deltaY: 400 })
    await espera(3500)
    ok(!reqs.some((r) => r.url.includes('googletagmanager.com')), 'nenhum script do Google carregou')
    await page.close()
  }

  const url = BASE + '/' + (LOCAL ? '?tags' : '')
  console.log(`\nCom as tags ligadas (${url})`)
  const { page, reqs, vazou } = await abrir(browser, url)
  const t0 = Date.now()
  await page
    .waitForFunction((ids) => ids.every((id) => window.google_tag_manager && id in window.google_tag_manager), { timeout: 15000 }, [g.analytics, g.ads, g.tagManager])
    .catch(() => {})
  const carregou = await page.evaluate(() => Object.keys(window.google_tag_manager || {}).filter((k) => /^(G|AW|GTM)-/.test(k)))
  console.log(`  (tags prontas ${((Date.now() - t0) / 1000).toFixed(1)} s depois da página carregar)`)
  for (const id of [g.analytics, g.ads, g.tagManager]) ok(carregou.includes(id), `${id} carregado`)

  const acha = (teste) => reqs.filter((r) => ehEnvio(r.url) && teste(r.url + '\n' + r.corpo))
  const ate = async (teste, ms = 12000) => { for (let t = 0; t < ms; t += 250) { if (acha(teste).length) return; await espera(250) } }
  await ate((s) => s.includes(g.analytics) && /en=page_view/.test(s))
  ok(acha((s) => s.includes(g.analytics) && /en=page_view/.test(s)).length > 0, `Analytics: visita (page_view) enviada pra ${g.analytics}`)

  // clique no botão do hero; o WhatsApp não chega a abrir
  await page.evaluate(() => addEventListener('click', (e) => e.preventDefault()))
  await page.click('a[data-zap="hero"]')
  const conv = (s) => s.includes(`/${contaAds}/`) && s.includes(rotulo)
  await ate(conv)
  await ate((s) => /en=whatsapp_click/.test(s))
  const conversoes = acha(conv)
  ok(conversoes.length > 0, `Google Ads: conversão ${g.conversaoWhatsapp} enviada no clique (${conversoes.length} requisição(ões): ${[...new Set(conversoes.map((r) => new URL(r.url).host))].join(', ')})`)
  // o Analytics manda o mesmo envio pra mais de um endereço do Google (mesmo _s)
  // e ele junta do lado de lá: conta envio único, não requisição
  const eventos = new Set(acha((s) => /en=whatsapp_click/.test(s)).map((r) => new URL(r.url).searchParams.get('_s')))
  ok(eventos.size === 1, `Analytics: evento whatsapp_click enviado uma vez (${eventos.size})`)
  const origem = acha((s) => /en=whatsapp_click/.test(s)).some((r) => /ep\.origem=hero/.test(r.url + r.corpo))
  ok(origem, 'Analytics: o evento diz de onde veio o clique (origem=hero)')
  const dl = await page.evaluate(() => window.dataLayer.filter((x) => x && x.event === 'whatsapp_click').length)
  ok(dl === 1, `Tag Manager: evento whatsapp_click no dataLayer (${dl})`)
  ok(vazou.length === 0, `nenhum dado chegou no Google de verdade${vazou.length ? ': ' + vazou.join(' | ') : ''}`)
  await page.close()
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0

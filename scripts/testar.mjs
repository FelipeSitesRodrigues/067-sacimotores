/**
 * Teste de cliques e de layout do site, no Chrome da máquina (puppeteer-core).
 *
 * - Estouro horizontal em 8 larguras, de 320 a 1920.
 * - Menu do celular: abre, marca aria-expanded, fecha no clique do link e no Esc.
 * - Todo link de WhatsApp: número certo e a mensagem de cada botão, decodificada.
 * - Âncoras do menu apontam pra seções que existem.
 * - Erros de console.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3067'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const NAVEGADOR = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))

  console.log('\nLarguras (estouro horizontal)')
  for (const w of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: w < 768 ? 800 : 860, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    ok(sw <= iw, `${w}px sem rolagem lateral (${sw}/${iw})`)
  }

  // Rola na roda do mouse, como gente de verdade (sem forçar nada): elemento
  // que fica sem .visivel é foto ou texto que o visitante nunca vai ver.
  console.log('\nRevelação no scroll')
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: w < 768 ? 844 : 860, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < altura; y += 120) {
      await page.mouse.wheel({ deltaY: 120 })
      await new Promise((r) => setTimeout(r, 30))
    }
    await new Promise((r) => setTimeout(r, 1500))
    const presos = await page.evaluate(() =>
      [...document.querySelectorAll('[data-revela]:not(.visivel)')].map((e) => `${e.tagName.toLowerCase()}.${e.classList[0] || '?'}`),
    )
    ok(presos.length === 0, `${w}px: todo elemento animado aparece${presos.length ? ` (presos: ${presos.join(', ')})` : ''}`)
  }

  console.log('\nMenu do celular')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.click('.cab__menu')
  let estado = await page.evaluate(() => ({
    aberto: !document.getElementById('menu-celular').hidden,
    aria: document.querySelector('.cab__menu').getAttribute('aria-expanded'),
    foco: document.activeElement?.textContent?.trim(),
  }))
  ok(estado.aberto && estado.aria === 'true', 'abre e marca aria-expanded=true')
  ok(estado.foco === 'Início', `foco vai pro primeiro link (${estado.foco})`)
  await page.click('.menu-celular a[href="#produtos"]')
  await new Promise((r) => setTimeout(r, 900))
  estado = await page.evaluate(() => ({
    aberto: !document.getElementById('menu-celular').hidden,
    y: Math.round(document.getElementById('produtos').getBoundingClientRect().top),
  }))
  ok(!estado.aberto, 'fecha ao tocar num link')
  ok(estado.y >= 0 && estado.y < 140, `rola até Produtos sem ficar escondido sob o cabeçalho (topo em ${estado.y}px)`)
  await page.click('.cab__menu')
  await page.keyboard.press('Escape')
  estado = await page.evaluate(() => ({ aberto: !document.getElementById('menu-celular').hidden, foco: document.activeElement?.className }))
  ok(!estado.aberto && String(estado.foco).includes('cab__menu'), 'Esc fecha e devolve o foco pro botão')

  console.log('\nLinks de WhatsApp')
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => ({
      href: a.href,
      origem: a.dataset.zap || '',
      texto: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim(),
      alvo: a.target,
    })),
  )
  const numeros = new Set([cfg.whatsapp, ...cfg.whatsappsExtras.map((x) => x.numero)])
  for (const l of links) {
    const u = new URL(l.href)
    const numero = u.pathname.replace(/\//g, '')
    ok(numeros.has(numero) && l.alvo === '_blank', `${l.origem.padEnd(18)} ${numero} "${l.texto}" -> ${u.searchParams.get('text')}`)
  }

  console.log('\nÂncoras')
  const ancoras = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))].map((h) => [h, !!document.querySelector(h)]),
  )
  for (const [h, existe] of ancoras) ok(existe, `${h} existe`)

  console.log('\nConsole')
  ok(erros.length === 0, `sem erros no console${erros.length ? ': ' + erros.join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0

/**
 * Build do site da Saci Motores. HTML, CSS e JS estático em dist/.
 *
 *   node build.mjs          (ou npm run build)
 *
 * Como funciona:
 * - src/index.html é a página. O CSS de src/css (primeiro os _*.css, depois o
 *   resto em ordem de nome) entra minificado num <style> no lugar de <!-- @css -->.
 *   O JS de src/js entra no lugar de <!-- @js -->. Uma requisição a menos cada,
 *   que no celular é o que separa 90 de 98 no Lighthouse.
 * - {{wa:chave}} vira o link do WhatsApp com a mensagem de site.config.json
 *   (mensagens.chave). {{wa:chave:5511...}} usa outro número.
 *   {{cfg.caminho}} puxa qualquer valor do config (ex.: {{cfg.telefone.exibir}}),
 *   no HTML e no JS. Trocar o número do WhatsApp ou os IDs do Google é mexer só no config.
 * - <i data-i="gear" data-w="light" class="..."></i> vira o SVG do Phosphor
 *   (@phosphor-icons/core) embutido. Peso padrão: regular.
 * - <!-- @schema --> recebe o JSON-LD de LocalBusiness montado do config.
 * - Copia src/assets e os ícones da raiz de src pra dist.
 * - Avisa se sobrou travessão (— ou –) no texto da página.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const avisos = []

// ---------------------------------------------------------------- utilidades
function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    if (statSync(a).isDirectory()) copiarPasta(a, b)
    else copyFileSync(a, b)
  }
}

function juntar(pasta, ext) {
  if (!existsSync(P(pasta))) return ''
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const ordem = [...todos.filter((f) => f.startsWith('_')).sort(), ...todos.filter((f) => !f.startsWith('_')).sort()]
  return ordem
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

// Minificação conservadora: comentários fora, espaços colapsados. Não mexe no
// espaço antes de ":" (em seletor, "a :hover" e "a:hover" são coisas diferentes).
function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n')
}

function valor(caminho) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

function linkWa(chave, numero = cfg.whatsapp) {
  const msg = cfg.mensagens[chave]
  if (!msg) avisos.push(`mensagem de WhatsApp sem chave: ${chave}`)
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg || '')}`
}

const cacheIcone = new Map()
function icone(nome, peso = 'regular', classe = '') {
  const arq = P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
  if (!existsSync(arq)) {
    avisos.push(`ícone não encontrado: ${nome} (${peso})`)
    return ''
  }
  if (!cacheIcone.has(arq)) {
    const svg = readFileSync(arq, 'utf8')
    cacheIcone.set(arq, svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''))
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${cacheIcone.get(arq)}</svg>`
}

function schema() {
  const e = cfg.endereco
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${cfg.dominio}/#empresa`,
    name: cfg.nome,
    alternateName: 'Saci Motores',
    description:
      'Compra, venda, troca e conserto de motores elétricos usados e revisados WEG e Eberle, redutores, motofreios e bombas d\'água, com envio para todo o Brasil.',
    url: `${cfg.dominio}/`,
    image: `${cfg.dominio}/assets/img/og-saci-motores.jpg`,
    logo: `${cfg.dominio}/assets/img/logo-600.png`,
    telephone: cfg.telefone.numero,
    email: cfg.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: e.rua,
      addressLocality: e.cidade,
      addressRegion: e.uf,
      addressCountry: 'BR',
      ...(e.cep ? { postalCode: e.cep } : {}),
    },
    areaServed: { '@type': 'Country', name: 'Brasil' },
    sameAs: [cfg.instagram, cfg.facebook],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: `+${cfg.whatsapp}`,
      contactType: 'sales',
      availableLanguage: 'Portuguese',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Produtos e serviços',
      itemListElement: [
        ['Motores elétricos usados e revisados', 'Product'],
        ['Redutores e motorredutores', 'Product'],
        ['Motofreios', 'Product'],
        ['Bombas d\'água', 'Product'],
        ['Troca de motor elétrico queimado', 'Service'],
        ['Rebobinagem e manutenção de motores elétricos', 'Service'],
      ].map(([name, tipo]) => ({ '@type': 'Offer', itemOffered: { '@type': tipo, name } })),
    },
  }
  return `<script type="application/ld+json">${JSON.stringify(dados)}</script>`
}

// ---------------------------------------------------------------- montagem
let html = readFileSync(P('src/index.html'), 'utf8')

// o JS entra antes dos marcadores, pra ele também poder usar {{cfg.caminho}}
html = html.replace('<!-- @js -->', `<script>${minJs(juntar('src/js', '.js'))}</script>`)
html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'regular', classe || ''))
html = html.replace(/\{\{wa:([\w-]+)(?::(\d+))?\}\}/g, (_, chave, numero) => linkWa(chave, numero))
html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => valor(c))
html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
html = html.replace('<!-- @schema -->', schema())
html = html.replace('<!-- @css -->', `<style>${minCss(juntar('src/css', '.css'))}</style>`)

const sobrou = html.match(/\{\{[^}]+\}\}/g)
if (sobrou) avisos.push(`marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)

// travessão no texto visível (fora de <style> e <script>)
const texto = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
if (tracos) avisos.push(`travessão no texto: ${tracos.join(' | ')}`)

// ---------------------------------------------------------------- saída
rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })
writeFileSync(path.join(DIST, 'index.html'), html)
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
for (const f of readdirSync(P('src'))) {
  const a = P('src', f)
  if (statSync(a).isFile() && f !== 'index.html') copyFileSync(a, path.join(DIST, f))
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`dist/index.html ${kb(Buffer.byteLength(html))}`)
if (avisos.length) {
  console.log('\nAVISOS:')
  for (const a of avisos) console.log(' -', a)
  process.exitCode = 1
}

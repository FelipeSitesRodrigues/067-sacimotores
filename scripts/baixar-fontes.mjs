/**
 * Baixa as fontes do Google Fonts e grava no próprio site (src/assets/fonts),
 * com o @font-face em src/css/_fontes.css. Fonte no próprio site levou a 047
 * de 78 a 97 no Lighthouse mobile.
 *
 * - Plus Jakarta Sans variável (400 a 800), só o subset latin, que cobre o
 *   português inteiro (acentos, ç, ½, ©).
 * - Dancing Script só com as letras de "Força para o seu trabalho", a
 *   assinatura manuscrita do hero. Sai com poucos KB.
 *
 * Uso: node scripts/baixar-fontes.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
mkdirSync('src/assets/fonts', { recursive: true })

async function css(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}
async function baixar(url, nome) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(`src/assets/fonts/${nome}`, buf)
  console.log('ok', nome, Math.round(buf.length / 1024) + ' KB')
}

const saida = []

// Plus Jakarta Sans, variável
const jakarta = await css('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap')
for (const [, subset, corpo] of jakarta.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)) {
  if (subset !== 'latin') continue
  const url = corpo.match(/url\(([^)]+)\)/)[1]
  const range = corpo.match(/unicode-range:\s*([^;]+);/)[1]
  await baixar(url, 'plus-jakarta-sans-var.woff2')
  saida.push(`@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('/assets/fonts/plus-jakarta-sans-var.woff2') format('woff2');
  unicode-range: ${range};
}`)
}

// Dancing Script, só as letras da assinatura
const texto = encodeURIComponent('Força para o seu trabalho')
const dancing = await css(`https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&text=${texto}`)
const url = dancing.match(/url\(([^)]+)\)/)[1]
await baixar(url, 'dancing-script-assinatura.woff2')
saida.push(`@font-face {
  font-family: 'Dancing Script';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/assets/fonts/dancing-script-assinatura.woff2') format('woff2');
}`)

writeFileSync('src/css/_fontes.css', `/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */\n${saida.join('\n')}\n`)
console.log('src/css/_fontes.css gravado')

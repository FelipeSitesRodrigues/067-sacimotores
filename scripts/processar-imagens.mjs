/**
 * Gera todas as imagens do site a partir de "../067 - Saci Motoes/Recursos Site".
 *
 * - Hero desktop e mobile em AVIF e WebP, em várias larguras (é o LCP).
 * - Fachada (SOBRE.png) e a foto real de rebobinagem do Wellington em WebP.
 * - Produtos: os três renders sem o fundo escuro (máscara de scripts/mascara.mjs,
 *   que sai de scripts/recortar-produtos.mjs) e a bomba KSB do site antigo, que já
 *   veio sem fundo. Todos no mesmo quadro 4:3, pra os cards ficarem alinhados.
 * - Logo, favicon (cabeça do Saci, que é o que se lê a 32 px), ícones do app
 *   e a imagem de compartilhamento (OG) que aparece no WhatsApp.
 *
 * Grava assets/img/manifesto.json com largura e altura de cada arquivo, pra pôr
 * width e height no HTML e não ter salto de layout.
 *
 * Uso: node scripts/processar-imagens.mjs   (ou npm run imagens)
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { recorte } from './mascara.mjs'

const R = '../067 - Saci Motoes/Recursos Site/'
const REAIS = R + 'IMAGENS REAIS DE SERVIÇO (MANDADAS PELO WELTON)/'
const OUT = 'src/assets/img/'
const RAIZ = 'src/'
mkdirSync(OUT, { recursive: true })
const manifesto = {}

async function registra(arq) {
  const m = await sharp(OUT + arq).metadata()
  manifesto[arq] = { w: m.width, h: m.height, kb: Math.round(readFileSync(OUT + arq).length / 1024) }
}

async function variantes(origem, nome, larguras, { webp = 76, avif = null } = {}) {
  const base = typeof origem === 'string' ? origem : await origem
  const meta = await sharp(base).metadata()
  for (const l of larguras) {
    const w = Math.min(l, meta.width)
    await sharp(base).resize({ width: w }).webp({ quality: webp, effort: 6 }).toFile(`${OUT}${nome}-${w}.webp`)
    await registra(`${nome}-${w}.webp`)
    if (avif) {
      await sharp(base).resize({ width: w }).avif({ quality: avif, effort: 6 }).toFile(`${OUT}${nome}-${w}.avif`)
      await registra(`${nome}-${w}.avif`)
    }
  }
}

// ---------- hero ----------
await variantes(R + 'MOBILE/IMAGEM HERO DESKTOP.png', 'hero-desktop', [960, 1280, 1672], { webp: 72, avif: 52 })
// 800 cobre 412 px a 1,75x (celular do Lighthouse) e 390 px a 2x (iPhone)
await variantes(R + 'MOBILE/IMAGEM HERO MOBILE.png', 'hero-mobile', [480, 800, 941], { webp: 72, avif: 52 })

// ---------- empresa (fachada) ----------
await variantes(R + 'SOBRE.png', 'fachada', [480, 720, 960, 1280, 1600], { webp: 76 })

// ---------- banner: foto real de rebobinagem ----------
// Estator rebobinado e envernizado, visto de cima (1200x1600). Faixa 3:2 no
// centro do anel: é o serviço pronto, que passa mais confiança que o fio solto.
const faixa = await sharp(REAIS + 'WhatsApp Image 2026-09-20 at 21.30.58.jpeg')
  .extract({ left: 0, top: 450, width: 1200, height: 800 })
  .toBuffer()
await variantes(faixa, 'oficina', [640, 960, 1200], { webp: 74 })

// ---------- CTA final: motor em close ----------
await variantes(R + 'SERVIÇOS - MOTOR ELÉTRICO.png', 'motor-close', [640, 1024], { webp: 70 })

// ---------- produtos ----------
// Quadro 640x480 transparente, produto centrado ocupando no máximo 94% x 86%.
async function quadro(png, nome) {
  const W = 640, H = 480
  const recortado = await sharp(png).trim({ threshold: 1 }).toBuffer()
  const caixa = await sharp(recortado).resize({ width: Math.round(W * 0.94), height: Math.round(H * 0.86), fit: 'inside' }).toBuffer()
  const m = await sharp(caixa).metadata()
  const cheio = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: caixa, left: Math.round((W - m.width) / 2), top: Math.round((H - m.height) / 2) }])
    .png()
    .toBuffer()
  for (const w of [240, 320, 480, 640]) {
    await sharp(cheio).resize({ width: w }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(`${OUT}produto-${nome}-${w}.webp`)
    await registra(`produto-${nome}-${w}.webp`)
  }
}
await quadro(await recorte('motor-eletrico'), 'motor-eletrico')
await quadro(await recorte('redutor'), 'redutor')
await quadro(await recorte('motofreio', { casco: [60, 245, 575, 820] }), 'motofreio')
const bomba = 'scripts/origem/bomba-d-agua-ksb.webp' // do site antigo, já sem fundo
if (!existsSync(bomba)) throw new Error(`Falta ${bomba}`)
await quadro(bomba, 'bomba-dagua')

// ---------- logo ----------
const logo = await sharp(R + '01 - LOGO.png').trim({ threshold: 10 }).toBuffer()
for (const w of [200, 400]) {
  await sharp(logo).resize({ width: w }).webp({ quality: 80, alphaQuality: 88, effort: 6, smartSubsample: true }).toFile(`${OUT}logo-${w}.webp`)
  await registra(`logo-${w}.webp`)
}
await sharp(logo).resize({ width: 600 }).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}logo-600.png`)
await registra('logo-600.png')

// ---------- favicon e ícones: cabeça do Saci ----------
const saci = R + '02 - LOGO - FAVICON.png'
const cabeca = await sharp(saci).extract({ left: 0, top: 0, width: 803, height: 780 }).trim({ threshold: 10 }).toBuffer()
async function icone(lado, fundo, margem) {
  const dentro = Math.round(lado * (1 - margem * 2))
  const img = await sharp(cabeca).resize({ width: dentro, height: dentro, fit: 'inside' }).toBuffer()
  const m = await sharp(img).metadata()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } })
    .composite([{ input: img, left: Math.round((lado - m.width) / 2), top: Math.round((lado - m.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
const transparente = { r: 0, g: 0, b: 0, alpha: 0 }
const branco = { r: 255, g: 255, b: 255, alpha: 1 }
writeFileSync(RAIZ + 'favicon-32.png', await icone(32, transparente, 0))
writeFileSync(RAIZ + 'icon-192.png', await icone(192, branco, 0.08))
writeFileSync(RAIZ + 'icon-512.png', await icone(512, branco, 0.08))
writeFileSync(RAIZ + 'apple-touch-icon.png', await icone(180, branco, 0.08))
// favicon.ico com o PNG de 32 px dentro (formato ICO aceita PNG embutido)
const png32 = await icone(32, transparente, 0)
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0)
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6)
ico.writeUInt8(32, 7)
ico.writeUInt8(0, 8)
ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10)
ico.writeUInt16LE(32, 12)
ico.writeUInt32LE(png32.length, 14)
ico.writeUInt32LE(22, 18)
writeFileSync(RAIZ + 'favicon.ico', Buffer.concat([ico, png32]))

// ---------- OG (compartilhamento no WhatsApp) ----------
const og = await sharp(R + 'MOBILE/IMAGEM HERO DESKTOP.png').resize({ width: 1200, height: 630, fit: 'cover', position: 'right' }).toBuffer()
const logoOg = await sharp(logo).resize({ width: 330 }).toBuffer()
const lm = await sharp(logoOg).metadata()
const placa = await sharp({ create: { width: lm.width + 56, height: lm.height + 40, channels: 4, background: branco } })
  .composite([{ input: logoOg, left: 28, top: 20 }])
  .png()
  .toBuffer()
const sombra = Buffer.from(
  `<svg width="1200" height="630"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#01173B" stop-opacity=".85"/><stop offset=".55" stop-color="#01173B" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`,
)
await sharp(og)
  .composite([
    { input: sombra, left: 0, top: 0 },
    { input: placa, left: 56, top: 56 },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(`${OUT}og-saci-motores.jpg`)
await registra('og-saci-motores.jpg')

writeFileSync(OUT + 'manifesto.json', JSON.stringify(manifesto, null, 2))
const total = Object.values(manifesto).reduce((s, v) => s + v.kb, 0)
console.log(`${Object.keys(manifesto).length} arquivos, ${total} KB no total`)

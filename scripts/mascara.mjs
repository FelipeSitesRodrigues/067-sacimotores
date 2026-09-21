/**
 * Junta as duas máscaras da IA de um render (original e clareada) numa só:
 * união, limiar, fechamento morfológico, buracos preenchidos e borda suave.
 * Devolve o render original em PNG com alfa (Buffer), pronto pro sharp.
 */
import sharp from 'sharp'

const R = '../067 - Saci Motoes/Recursos Site/'
export const RENDERS = {
  'motor-eletrico': 'SERVIÇOS - MOTOR ELÉTRICO.png',
  redutor: 'SERVIÇOS - REDUTOR.png',
  motofreio: 'SERVIÇOS - MOTOR FREIO.png',
}

async function canal(arq) {
  const img = sharp(arq)
  const m = await img.metadata()
  const c = m.hasAlpha ? img.extractChannel('alpha') : img.greyscale()
  return c.raw().toBuffer({ resolveWithObject: true })
}

// max (dilata) ou min (erode) numa janela quadrada 2r+1, separável
export function morfo(bin, W, H, r, dilata) {
  const tmp = new Uint8Array(W * H)
  const out = new Uint8Array(W * H)
  const alvo = dilata ? 1 : 0
  for (let y = 0; y < H; y++) {
    let ult = -1e9
    for (let x = 0; x < W; x++) if (bin[y * W + x] === alvo) ult = x, 0
    // passada simples com distância ao último "alvo" nos dois sentidos
    let esq = -1e9
    const dist = new Int32Array(W).fill(1e9)
    for (let x = 0; x < W; x++) {
      if (bin[y * W + x] === alvo) esq = x
      dist[x] = x - esq
    }
    let dir = 1e9
    for (let x = W - 1; x >= 0; x--) {
      if (bin[y * W + x] === alvo) dir = x
      dist[x] = Math.min(dist[x], dir - x)
      tmp[y * W + x] = dist[x] <= r ? alvo : 1 - alvo
    }
  }
  for (let x = 0; x < W; x++) {
    let cima = -1e9
    const dist = new Int32Array(H).fill(1e9)
    for (let y = 0; y < H; y++) {
      if (tmp[y * W + x] === alvo) cima = y
      dist[y] = y - cima
    }
    let baixo = 1e9
    for (let y = H - 1; y >= 0; y--) {
      if (tmp[y * W + x] === alvo) baixo = y
      dist[y] = Math.min(dist[y], baixo - y)
      out[y * W + x] = dist[y] <= r ? alvo : 1 - alvo
    }
  }
  return out
}

export function preencherBuracos(bin, W, H) {
  const fora = new Uint8Array(W * H)
  const pilha = []
  for (let x = 0; x < W; x++) pilha.push(x, (H - 1) * W + x)
  for (let y = 0; y < H; y++) pilha.push(y * W, y * W + W - 1)
  while (pilha.length) {
    const i = pilha.pop()
    if (fora[i] || bin[i]) continue
    fora[i] = 1
    const x = i % W
    if (x > 0) pilha.push(i - 1)
    if (x < W - 1) pilha.push(i + 1)
    if (i >= W) pilha.push(i - W)
    if (i < W * (H - 1)) pilha.push(i + W)
  }
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) out[i] = fora[i] ? 0 : 1
  return out
}

// Casco convexo (cadeia monótona) dos pixels da máscara dentro de uma caixa,
// rasterizado por linha. Serve pra peça cilíndrica escura que encosta no fundo
// e a IA não fecha (carcaça do freio do motofreio).
export function cascoNaCaixa(bin, W, H, [x0, y0, x1, y1]) {
  const pts = []
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (bin[y * W + x]) pts.push([x, y])
  if (pts.length < 3) return bin
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const inf = [], sup = []
  for (const p of pts) { while (inf.length >= 2 && cruz(inf.at(-2), inf.at(-1), p) <= 0) inf.pop(); inf.push(p) }
  for (const p of pts.toReversed()) { while (sup.length >= 2 && cruz(sup.at(-2), sup.at(-1), p) <= 0) sup.pop(); sup.push(p) }
  const poli = [...inf.slice(0, -1), ...sup.slice(0, -1)]
  const out = bin.slice()
  for (let y = y0; y <= y1; y++) {
    const xs = []
    for (let i = 0; i < poli.length; i++) {
      const [ax, ay] = poli[i], [bx, by] = poli[(i + 1) % poli.length]
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) out[y * W + x] = 1
  }
  return out
}

// Tira ilhas pequenas (parafuso solto que ficou fora do contorno, sujeira da IA)
export function tirarIlhas(bin, W, H, minimo = 600) {
  const rot = new Int32Array(W * H)
  const out = bin.slice()
  let id = 0
  for (let s = 0; s < W * H; s++) {
    if (!bin[s] || rot[s]) continue
    id++
    const pilha = [s], comp = []
    rot[s] = id
    while (pilha.length) {
      const i = pilha.pop()
      comp.push(i)
      const x = i % W
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j >= 0 && j < W * H && bin[j] && !rot[j]) { rot[j] = id; pilha.push(j) }
      }
    }
    if (comp.length < minimo) for (const i of comp) out[i] = 0
  }
  return out
}

export async function recorte(chave, { limiar = 110, fecha = 12, erode = 1, casco = null } = {}) {
  const a = await canal(`scripts/.cache/ia-orig-${chave}.png`)
  const b = await canal(`scripts/.cache/ia-claro-${chave}.png`)
  const { width: W, height: H } = a.info
  let bin = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) bin[i] = Math.max(a.data[i], b.data[i]) > limiar ? 1 : 0
  bin = morfo(morfo(bin, W, H, fecha, true), W, H, fecha, false)
  bin = preencherBuracos(bin, W, H)
  if (casco) bin = cascoNaCaixa(bin, W, H, casco)
  bin = tirarIlhas(bin, W, H)
  if (erode) bin = morfo(bin, W, H, erode, false)
  const alfa = Buffer.alloc(W * H)
  for (let i = 0; i < W * H; i++) alfa[i] = bin[i] * 255
  const alfaSuave = await sharp(alfa, { raw: { width: W, height: H, channels: 1 } }).blur(0.9).extractChannel(0).raw().toBuffer()
  // removeAlpha roda no fim do pipeline do sharp e apagaria o alfa novo: tira antes, em raw
  const rgb = await sharp(R + RENDERS[chave]).removeAlpha().raw().toBuffer()
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alfaSuave, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()
}

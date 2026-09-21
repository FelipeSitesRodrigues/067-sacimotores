/**
 * Passo 1 do recorte: clareia os renders de produto antes da IA.
 * As partes escuras do motor (tampa do ventilador, carcaça do freio) somem
 * no fundo preto e a IA marca como fundo. Clareando, elas se separam do preto.
 * A máscara sai da versão clara e é aplicada na foto original depois.
 *
 * Chamado por scripts/recortar-produtos.mjs. Grava scripts/.cache/claro-*.png
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const R = '../067 - Saci Motoes/Recursos Site/'
export const RENDERS = [
  ['SERVIÇOS - MOTOR ELÉTRICO.png', 'motor-eletrico'],
  ['SERVIÇOS - REDUTOR.png', 'redutor'],
  ['SERVIÇOS - MOTOR FREIO.png', 'motofreio'],
]
mkdirSync('scripts/.cache', { recursive: true })
for (const [arq, chave] of RENDERS) {
  await sharp(R + arq).gamma(2.2, 1.0).linear(1.35, 6).modulate({ saturation: 1.25 }).png().toFile(`scripts/.cache/claro-${chave}.png`)
  console.log('claro', chave)
}

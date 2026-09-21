/**
 * Máscara dos renders de produto pela IA (@imgly), em duas versões:
 *   scripts/.cache/ia-orig-*.png   IA na foto original
 *   scripts/.cache/ia-claro-*.png  IA na foto clareada (scripts/clarear-renders.mjs)
 * Cada versão perde partes diferentes do motor no fundo escuro. A junção das
 * duas, com os buracos preenchidos, sai em scripts/processar-imagens.mjs.
 *
 * Fica em processo separado porque o pacote traz outra versão do sharp, e
 * duas versões no mesmo processo derrubam o libvips (mesmo motivo do 066).
 *
 * Uso: node scripts/recortar-produtos.mjs [--forcar]
 */
import { removeBackground } from '@imgly/background-removal-node'
import { writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const R = '../067 - Saci Motoes/Recursos Site/'
const RENDERS = {
  'motor-eletrico': 'SERVIÇOS - MOTOR ELÉTRICO.png',
  redutor: 'SERVIÇOS - REDUTOR.png',
  motofreio: 'SERVIÇOS - MOTOR FREIO.png',
}
execFileSync(process.execPath, ['scripts/clarear-renders.mjs'], { stdio: 'inherit' })

async function mascara(origem, saida) {
  if (existsSync(saida) && !process.argv.includes('--forcar')) return console.log('já existe', saida)
  const blob = await removeBackground(pathToFileURL(path.resolve(origem)).href, {
    model: 'medium',
    output: { format: 'image/png', type: 'mask' },
  })
  writeFileSync(saida, Buffer.from(await blob.arrayBuffer()))
  console.log('ok', saida)
}
for (const [chave, arq] of Object.entries(RENDERS)) {
  await mascara(R + arq, `scripts/.cache/ia-orig-${chave}.png`)
  await mascara(`scripts/.cache/claro-${chave}.png`, `scripts/.cache/ia-claro-${chave}.png`)
}

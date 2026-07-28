/**
 * Extraction entrypoint. Run once; every later analysis reads the cache.
 *
 *   npx tsx src/harness/fitting/extract-run.ts <csv> <cacheDir> [maxSymbols]
 */
import { loadStockCsv } from './dataset'
import { extractCorpus, writeCorpus } from './corpus'

const [csv, cacheDir, maxSymbolsArg] = process.argv.slice(2)
if (csv === undefined || cacheDir === undefined) {
  throw new Error('usage: extract-run.ts <csv> <cacheDir> [maxSymbols]')
}
const maxSymbols = maxSymbolsArg === undefined ? undefined : Number(maxSymbolsArg)

const t0 = Date.now()
const dataset = await loadStockCsv(csv)
console.log(`[load] ${dataset.series.length} symbols, ${dataset.dates.length} dates, `
  + `${dataset.rowsParsed} rows, rejected ${JSON.stringify(dataset.rejected)} (${Date.now() - t0}ms)`)

const t1 = Date.now()
let lastLog = 0
const corpus = extractCorpus(dataset, {
  maxSymbols,
  onProgress: (done, total) => {
    if (done - lastLog >= 25 || done === total) {
      lastLog = done
      const el = (Date.now() - t1) / 1000
      console.log(`[extract] ${done}/${total} symbols  ${el.toFixed(0)}s elapsed  eta ${(el / done * (total - done)).toFixed(0)}s`)
    }
  },
})
console.log(`[extract] ${corpus.rows} rows in ${((Date.now() - t1) / 1000).toFixed(0)}s`)
console.log(`[extract] skipped: ${JSON.stringify(corpus.skipped)}`)

await writeCorpus(corpus, cacheDir)
console.log(`[cache] written to ${cacheDir}`)

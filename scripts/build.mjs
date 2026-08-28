/**
 * Build entry. tsdown 0.22 uses `Promise.withResolvers` (ES2024), which is
 * missing on Node 20; polyfill it here, then run the real tsdown CLI.
 */
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

await import('../node_modules/tsdown/dist/run.mjs')

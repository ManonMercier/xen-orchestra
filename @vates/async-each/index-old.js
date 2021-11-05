const noop = Function.prototype

exports.asyncEach = function asyncEach(iterable, cb, { concurrency = Infinity } = {}) {
  return new Promise((resolve, reject) => {
    const it = iterable[Symbol.iterator]()
    let running = 0

    resolve = (resolve =>
      function resolveAndClean(value) {
        resolve(value)
        onFulfilled = onRejected = noop
      })(resolve)
    reject = (reject =>
      function rejectAndClean(reason) {
        reject(reason)
        onFulfilled = onRejected = noop
      })(reject)

    let onFulfilled = value => {
      --running
      pop()
    }
    const onFulfilledWrapper = value => onFulfilled(value)

    let onRejected = reject
    const onRejectedWrapper = reason => onRejected(reason)

    let i = 0
    let pop = () => {
      // todo: handle async iterator
      if (running < concurrency) {
        const cursor = it.next()
        if (cursor.done) {
          pop = () => {
            if (running === 0) {
              resolve()
            }
          }
        } else {
          ++running
          try {
            const result = cb.call(this, cursor.value, ++i, iterable)
            let then
            if (result != null && typeof result === 'object' && typeof (then = result.then) === 'function') {
              then.call(result, onFulfilledWrapper, onRejectedWrapper)
            } else {
              onFulfilled(result)
            }
          } catch (error) {
            onRejected(error)
          }
        }
        return pop()
      }
    }
  })
}

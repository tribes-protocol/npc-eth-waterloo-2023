
import BN from 'bn.js'

export function isNull(obj: any): obj is null | undefined {
  return obj === null || obj === undefined
}

export function compactMap<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(item => !isNull(item)) as T[]
}

export function asString(arg: any): string {
  if (isNull(arg) || typeof arg !== 'string') {
    throw new Error(`Expected string, got ${arg}`)
  }
  return arg
}

// asNumber
export function asNumber(arg: any): number {
  if (isNull(arg) || typeof arg !== 'number') {
    throw new Error(`Expected number, got ${arg}`)
  }
  return arg
}

export function toJsonTree(obj: any): any {
  // return primitives and null/undefined unchanged
  if (typeof obj !== 'object' || isNull(obj)) {
    return obj
  }

  // transform each item for arrays
  if (Array.isArray(obj)) {
    return obj.map(toJsonTree)
  }

  // transform URLs to string
  if (obj instanceof URL) {
    return obj.toString()
  }

  // transfer BN to decimal string
  if (BN.isBN(obj)) {
    return obj.toString(10)
  }

  // use toJSON() if available
  if (typeof obj.toJSON === 'function') {
    return obj.toJSON()
  }

  // transform each value for objects
  return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, toJsonTree(val)]))
}

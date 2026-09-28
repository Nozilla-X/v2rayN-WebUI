export type UuidCrypto = Pick<Crypto, 'getRandomValues'> & {
  randomUUID?: () => string
}

export function createUuid(cryptoApi?: UuidCrypto): string

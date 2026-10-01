// "1 watch", "2 watches", "3 films": the count and the right form of the word.
export const plural = (n, word) => `${n} ${n === 1 ? word : /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`}`;

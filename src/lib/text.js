// "1 watch", "2 watches", "3 entries", "4 films": the count and the right form of the word.
export const plural = (n, word) => `${n} ${n === 1 ? word : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`}`;

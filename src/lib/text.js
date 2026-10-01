// "1 watch", "2 watches", "3 entries", "2 shelves", "4 films": the count and the right form of the word.
const IRREGULAR = { shelf: "shelves" };
export const plural = (n, word) => `${n} ${n === 1 ? word : IRREGULAR[word] || (/[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`)}`;

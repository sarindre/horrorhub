import { useCallback, useEffect, useState } from "react";
import { addFilm, createShelf, editShelf, loadShelves, mergeShelves, moveFilm, relinkShelves, removeFilm, saveShelves } from "../lib/shelves.js";

// Your shelves, persisted locally. Every callback is stable (functional updates
// only), so effects that depend on them don't restart on every render.
export function useShelves() {
  const [shelves, setShelves] = useState(loadShelves);
  useEffect(() => {
    saveShelves(shelves);
  }, [shelves]);

  const change = useCallback((id, fn) => setShelves((prev) => prev.map((s) => (s.id === id ? fn(s) : s))), []);

  // returns the new shelf, or null if it had no usable name
  const create = useCallback(({ name, description, films } = {}) => {
    const shelf = createShelf({ name, description, films });
    if (shelf) setShelves((prev) => [shelf, ...prev]);
    return shelf;
  }, []);
  const remove = useCallback((id) => setShelves((prev) => prev.filter((s) => s.id !== id)), []);
  const addToShelf = useCallback((id, film) => change(id, (s) => addFilm(s, film)), [change]);
  const removeFromShelf = useCallback((id, filmId) => change(id, (s) => removeFilm(s, filmId)), [change]);
  const move = useCallback((id, filmId, delta) => change(id, (s) => moveFilm(s, filmId, delta)), [change]);
  const edit = useCallback((id, patch) => change(id, (s) => editShelf(s, patch)), [change]);
  // an imported film was matched to TMDb: keep shelves pointing at it
  const relink = useCallback((oldId, movie) => setShelves((prev) => relinkShelves(prev, oldId, movie)), []);

  // returns how many were new
  const merge = useCallback(
    (incoming) => {
      const { shelves: next, added } = mergeShelves(shelves, incoming);
      if (added) setShelves(next);
      return added;
    },
    [shelves]
  );

  return { shelves, create, remove, addFilm: addToShelf, removeFilm: removeFromShelf, moveFilm: move, edit, relink, merge };
}

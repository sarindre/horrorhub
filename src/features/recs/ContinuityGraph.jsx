import { useEffect, useMemo, useRef, useState } from "react";
import { Wand2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { TMDB_IMG, describeError, isAbort, tmdbGet } from "../../lib/tmdb.js";

export function ContinuityGraph({ items, apiKey, onOpenDetails }){
  const [seedId, setSeedId] = useState(() => (items.find(i => (i.rating || 0) >= 4)?.id ?? items[0]?.id));
  const [nodes, setNodes] = useState([]); // {id,title,poster}
  const [edges, setEdges] = useState([]); // {from,to}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  // cancel a map still being built when leaving the tab
  useEffect(() => () => abortRef.current?.abort(), []);

  const seed = useMemo(() => items.find(i => i.id === seedId) || items[0], [items, seedId]);

  const build = async () => {
    if (!apiKey || !seed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const center = [{ id: String(seed.id), title: seed.title, poster: seed.poster ? TMDB_IMG(seed.poster, 'w342') : '' }];
      const seen = new Map(center.map(n => [n.id, n]));
      const data = await tmdbGet(`/movie/${seed.id}/recommendations?language=en-US&page=1`, { apiKey, signal: controller.signal });
      const results = Array.isArray(data?.results) ? data.results.slice(0, 12) : [];
      const outEdges = [];
      for (const r of results) {
        const nid = String(r.id);
        if (!seen.has(nid)) {
          seen.set(nid, { id: nid, title: r.title, poster: TMDB_IMG(r.poster_path, 'w185') });
        }
        outEdges.push({ from: String(seed.id), to: nid });
      }
      setNodes([...seen.values()]);
      setEdges(outEdges);
    } catch (e) {
      if (isAbort(e)) return;
      setError(e);
      setNodes([]); setEdges([]);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const layout = useMemo(() => {
    const center = { id: String(seed?.id ?? '0'), x: 320, y: 180 };
    const others = nodes.filter(n => n.id !== center.id);
    const R = 130;
    const placed = others.map((n, i) => ({ id: n.id, x: center.x + R * Math.cos((i/Math.max(1,others.length)) * 2*Math.PI), y: center.y + R * Math.sin((i/Math.max(1,others.length)) * 2*Math.PI) }));
    return { center, placed };
  }, [nodes, seed?.id]);

  const pos = (id) => {
    if (String(id) === layout.center.id) return layout.center;
    return layout.placed.find(p => p.id === String(id)) || { x: 0, y: 0 };
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <Wand2 className="h-4 w-4" /> Because You Liked…
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-transparent border rounded px-2 py-1 text-sm" value={seedId} onChange={(e)=> setSeedId(isNaN(Number(e.target.value))? e.target.value : Number(e.target.value))}>
              {items.map(i=> (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={build} disabled={loading || !apiKey}>{loading? 'Building…':'Build Map'}</Button>
          </div>
        </div>
        {!apiKey ? (
          <div className="text-sm opacity-70">Add your TMDb API token in Settings to build a map.</div>
        ) : error ? (
          <div role="alert" className="text-sm text-red-300">{describeError(error)}</div>
        ) : null}
        <div className="rounded-2xl border bg-black/20">
          <svg viewBox="0 0 640 360" className="w-full h-[360px]">
            <g stroke="rgba(255,255,255,0.25)" strokeWidth="1">
              {edges.map((e,idx)=>{ const a=pos(e.from), b=pos(e.to); return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>; })}
            </g>
            {nodes.map(n=>{ const p=pos(n.id); const isCenter=String(n.id)===String(seed?.id);
              return (
                <g key={n.id} transform={`translate(${p.x - 22}, ${p.y - 22})`} style={{cursor:'pointer'}} onClick={()=> onOpenDetails?.({ id: isNaN(Number(n.id))? n.id : Number(n.id), title: n.title, poster: n.poster })}>
                  <circle cx="22" cy="22" r="24" fill={isCenter? 'rgba(250,204,21,0.25)':'rgba(239,68,68,0.2)'} stroke={isCenter? 'rgba(250,204,21,0.7)':'rgba(239,68,68,0.6)'} />
                  <image href={n.poster||''} x={-4} y={-4} width={52} height={52} preserveAspectRatio="xMidYMid slice" clipPath="circle(22px at 22px 22px)" />
                  <title>{n.title}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

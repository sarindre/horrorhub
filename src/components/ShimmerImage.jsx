import { useState } from "react";
import { Film } from "lucide-react";

// Simple shimmer image with fallback
export function ShimmerImage({ src, alt, className }){
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="relative">
      {!loaded && !error && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {src && !error ? (
        <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onLoad={()=> setLoaded(true)} onError={()=> setError(true)} />
      ) : (
        <div className={`flex items-center justify-center ${className}`}>
          <Film className="h-6 w-6 opacity-60" />
        </div>
      )}
    </div>
  );
}

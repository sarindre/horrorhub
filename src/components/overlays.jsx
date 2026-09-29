import React from "react";

// Ambient edge flicker overlay
export function FlickerOverlay() {
  const [spots, setSpots] = React.useState(() => makeSpots());

  function makeSpot(i) {
    const edge = Math.random() < 0.5 ? 0 : 1; // left or right edge
    const x = edge === 0 ? Math.random() * 8 : 92 + Math.random() * 8; // vw
    const y = Math.random() * 100; // vh
    const size = 10 + Math.random() * 18; // vw
    const delay = Math.random() * 6;
    const duration = 4 + Math.random() * 10;
    const red = 'rgba(239,68,68,0.10)';
    const pale = 'rgba(255,255,255,0.06)';
    const color = Math.random() < 0.6 ? red : pale;
    return { id: i, x, y, size, delay, duration, color };
  }

  function makeSpots() {
    return Array.from({ length: 4 }).map((_, i) => makeSpot(i));
  }

  React.useEffect(() => {
    const iv = setInterval(() => {
      setSpots((prev) => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = makeSpot(idx);
        return next;
      });
    }, 3000 + Math.random() * 2000);

    const onScroll = () => {
      setSpots((prev) => prev.map((s) => ({ ...s, y: (s.y + 5) % 100 })));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearInterval(iv); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {spots.map((s) => (
        <span
          key={s.id}
          className="flicker-spot"
          style={{
            left: `${s.x}vw`,
            top: `${s.y}vh`,
            width: `${s.size}vw`,
            height: `${s.size}vw`,
            background: `radial-gradient(circle at center, ${s.color}, transparent 60%)`,
            animation: `flickerPulse ${s.duration}s infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Fog overlay
export function FogOverlay(){
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <div className="fog-layer fog-left" />
      <div className="fog-layer fog-right" />
    </div>
  );
}

// Ambient audio — subtle whispers + heartbeat using WebAudio
export function AmbientAudio(){
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    let ctx; let noiseNode; let gain; let interval;
    const start = async () => {
      if (startedRef.current) return; startedRef.current = true;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Whisper: filtered noise
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++){ data[i] = Math.random()*2-1; }
      noiseNode = ctx.createBufferSource(); noiseNode.buffer = noiseBuffer; noiseNode.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 600; filter.Q.value = 0.7;
      gain = ctx.createGain(); gain.gain.value = 0.02; // very subtle
      noiseNode.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      noiseNode.start();
      // Heartbeat: short low thump periodically
      const kick = () => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(60, ctx.currentTime);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35);
      };
      kick(); interval = setInterval(kick, 1600);
    };
    const resume = () => { start(); window.removeEventListener('pointerdown', resume); };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => { try{ noiseNode && noiseNode.stop(); }catch{} clearInterval(interval); if (ctx && ctx.close) ctx.close(); window.removeEventListener('pointerdown', resume); };
  }, []);
  return null;
}

// Lights-out overlay
export function LightsOutOverlay(){
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="lightsout-dim" />
      <div className="candle-spot" />
    </div>
  );
}

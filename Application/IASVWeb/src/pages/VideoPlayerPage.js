import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Hls from 'hls.js';

export default function VideoPlayerPage() {
  const [params] = useSearchParams();
  const src = params.get('src');
  const name = params.get('name') || 'Lecture';
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;

    const isHls = /\.m3u8($|\?)/i.test(src);
    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = src;
    return undefined;
  }, [src]);

  return (
    <div>
      <Link to="/videos" className="iasv-btn iasv-btn-ghost" style={{ marginBottom: 16 }}>← Retour</Link>
      <h1 className="iasv-page-title">{decodeURIComponent(name)}</h1>
      {!src ? (
        <div className="iasv-error">Aucune vidéo sélectionnée.</div>
      ) : (
        <div className="iasv-card" style={{ padding: 0, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            controls
            playsInline
            style={{ width: '100%', display: 'block', background: '#000' }}
          />
        </div>
      )}
    </div>
  );
}

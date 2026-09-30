import { useEffect, useRef } from 'react';

type AmbientVideoProps = {
  src: string;
  poster: string;
  className?: string;
  preload?: 'none' | 'metadata' | 'auto';
};

/** Silent decorative video that pauses offscreen and respects reduced motion. */
export function AmbientVideo({
  src,
  poster,
  className,
  preload = 'metadata',
}: AmbientVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const syncPlayback = () => {
      if (motion.matches || !visible) {
        video.pause();
        if (motion.matches) video.currentTime = 0;
      } else {
        void video.play().catch(() => {
          // Poster remains visible if the browser blocks autoplay.
        });
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      },
      { rootMargin: '120px' }
    );
    observer.observe(video);
    motion.addEventListener('change', syncPlayback);

    return () => {
      observer.disconnect();
      motion.removeEventListener('change', syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      preload={preload}
      muted
      loop
      playsInline
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

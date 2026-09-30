import { useEffect } from 'react';
import { Link } from 'wouter';
import { getAssetUrl } from '../lib/assets';
import './not-found.css';

export default function NotFound() {
  useEffect(() => {
    const title = document.title;
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const robots = existingRobots ?? document.createElement('meta');
    const previousRobots = robots.getAttribute('content');
    robots.name = 'robots';
    robots.content = 'noindex';
    if (!existingRobots) document.head.appendChild(robots);
    document.title = '404 — Page not found | Squabblemon';
    return () => {
      document.title = title;
      if (!existingRobots) robots.remove();
      else if (previousRobots === null) robots.removeAttribute('content');
      else robots.content = previousRobots;
    };
  }, []);

  return (
    <main className="not-found-page" aria-labelledby="not-found-title">
      <img className="not-found-wordmark" src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')} alt="Squabblemon" width="180" />
      <img className="not-found-art" data-testid="not-found-art" src={getAssetUrl('brand/not-found-sm-gold.webp')} alt="" aria-hidden="true" width="1200" height="900" draggable={false} />
      <h1 id="not-found-title"><span className="sr-only">404 — </span>Unknown Street</h1>
      <p>This page doesn’t exist. Head back to Squabblemon.</p>
      <Link href="/" className="not-found-home" data-testid="not-found-home">Back to Squabblemon</Link>
    </main>
  );
}

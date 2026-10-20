import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StoryCinematic } from '../src/components/StoryCinematic';
import { StoryMovie } from '../src/pages/game/story/StoryMovie';
import '../src/index.css';

const cinematic = {
  videoAssetId: 'assets/media-loading-test.mp4',
  posterAssetId: 'assets/media-loading-test-poster.svg',
  environmentAssetId: 'assets/media-loading-test-poster.svg',
};

function Fixture() {
  const [result, setResult] = useState('');
  const mode = new URLSearchParams(location.search).get('mode');
  return result ? <p role="status">{result}</p> : mode === 'cinematic' ? (
    <StoryCinematic source={cinematic.videoAssetId} poster={cinematic.posterAssetId}
      title="Cinematic loading test" eyebrow="Test chapter"
      onComplete={() => setResult('Continued')} onSkip={() => setResult('Skipped')} />
  ) : (
    <StoryMovie cinematic={cinematic} title="Chapter loading test"
      onContinue={() => setResult('Continued')} onClose={() => setResult('Closed')} />
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);

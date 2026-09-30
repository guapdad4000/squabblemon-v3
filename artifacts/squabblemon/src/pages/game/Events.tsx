import { useEffect, useRef } from 'react';
import { Link, useSearch } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { SafehouseBulletinBoardContent } from '../../components/SafehouseBulletinBoard';
import { EventFeedbackSection } from '../../components/EventFeedback';
import { FEEDBACK_SECTION_ID } from '../../content/bulletinBoard';

export function Events({ playerId }: { playerId: string }) {
  const search = useSearch();
  const main = useRef<HTMLElement>(null);
  const wantsFeedback = new URLSearchParams(search).get('section') === 'feedback';

  useEffect(() => {
    if (!wantsFeedback) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(FEEDBACK_SECTION_ID);
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [wantsFeedback, search]);

  return <main ref={main} className="events-page" aria-labelledby="events-title" data-testid="page-events">
    <div className="events-page__bar"><Link href="/game" className="events-page__back" data-testid="link-back-safehouse"><ArrowLeft size={15} aria-hidden="true" />Back to Safehouse</Link></div>
    <SafehouseBulletinBoardContent playerId={playerId}>
      <EventFeedbackSection playerId={playerId} />
    </SafehouseBulletinBoardContent>
  </main>;
}

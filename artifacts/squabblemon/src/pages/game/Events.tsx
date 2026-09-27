import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { SafehouseBulletinBoardContent } from '../../components/SafehouseBulletinBoard';

export function Events() {
  return <main className="events-page" aria-labelledby="events-title">
    <Link className="events-page__back" href="/game"><ArrowLeft size={15} /> Back to the Safehouse</Link>
    <SafehouseBulletinBoardContent />
  </main>;
}

import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { MessageSquareText, RefreshCw, Send } from 'lucide-react';
import { ApiError, useSubmitEventFeedback, type EventFeedbackCategory, type EventFeedbackPost } from '@workspace/api-client-react';
import { dedupePosts, isValidReceipt, MalformedFeedbackResponse, useAddSavedFeedback, useEventFeedbackFeed } from '../hooks/use-event-feedback';
import { FEEDBACK_SECTION_ID } from '../content/bulletinBoard';
import '../styles/event-feedback.css';

const MAX = 2000;
const CATEGORY_LABEL: Record<EventFeedbackCategory, string> = { bug: 'Bug report', suggestion: 'Suggestion', general: 'General feedback' };

function newRetryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

type SubmitError = { kind: 'auth' | 'rate' | 'conflict' | 'validation' | 'unconfirmed' | 'other'; text: string };

function describeError(error: unknown): SubmitError {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string; retryAfterSeconds?: number } | null;
    if (error.status === 401) return { kind: 'auth', text: 'Your game session has expired, so this was not saved. Your draft is still here.' };
    if (error.status === 429) {
      const header = Number(error.headers.get('Retry-After'));
      const secs = data?.retryAfterSeconds ?? (Number.isFinite(header) && header > 0 ? header : undefined);
      return { kind: 'rate', text: `You have sent a lot of feedback recently. ${secs ? `Try again in about ${Math.ceil(secs / 60)} minute${Math.ceil(secs / 60) === 1 ? '' : 's'}.` : 'Try again a little later.'} Your draft is still here.` };
    }
    if (error.status === 409) return { kind: 'conflict', text: 'This send clashed with an earlier saved post, so nothing new was posted. Check the feed below. To post something new, change the category or message first.' };
    if (error.status === 400) return { kind: 'validation', text: data?.error ? `The board could not accept this: ${data.error}` : 'The board could not accept this message. Check the category and message.' };
    if (error.status === 503) return { kind: 'unconfirmed', text: 'We could not confirm your post was saved. Send again safely; it will not be posted twice.' };
    return { kind: 'unconfirmed', text: 'Something went wrong and we could not confirm your post. Send again safely; it will not be posted twice.' };
  }
  if (error instanceof MalformedFeedbackResponse) return { kind: 'unconfirmed', text: 'We could not confirm your post was saved. Send again safely; it will not be posted twice.' };
  return { kind: 'unconfirmed', text: 'Connection trouble: we could not confirm your post. Send again safely; it will not be posted twice.' };
}

export function EventFeedbackForm({ playerId }: { playerId: string }) {
  const uid = useId();
  const [category, setCategory] = useState<EventFeedbackCategory | ''>('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ category?: string; message?: string }>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ id: string; key: string; conflicted: boolean } | null>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const submit = useSubmitEventFeedback();
  const mutateRef = useRef(submit.mutateAsync);
  mutateRef.current = submit.mutateAsync;
  const addSaved = useAddSavedFeedback(playerId);

  const focusField = (el: HTMLElement | null) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    (el.closest('.feedback-field') ?? el).scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const trimmed = message.trim();
    const next: typeof errors = {};
    if (!category) next.category = 'Choose a category.';
    if (!trimmed) next.message = 'Write a message before sending.';
    else if (trimmed.length > MAX) next.message = `Keep it under ${MAX} characters.`;
    setErrors(next);
    if (next.category) { focusField(categoryRef.current); return; }
    if (next.message) { focusField(messageRef.current); return; }
    const cat = category as EventFeedbackCategory;
    const key = `${cat}\n${trimmed}`;
    if (attempt.current && attempt.current.key === key && attempt.current.conflicted) {
      setSubmitError({ kind: 'conflict', text: 'This exact message already clashed with an earlier send, so it was not sent again. Change the category or message before submitting.' });
      focusField(messageRef.current);
      return;
    }
    if (!attempt.current || attempt.current.key !== key) attempt.current = { id: newRetryId(), key, conflicted: false };
    const retryId = attempt.current.id;
    inFlight.current = true; setBusy(true); setSubmitError(null); setStatus('Sending to the board...');
    try {
      const receipt: unknown = await mutateRef.current({ data: { category: cat, message: trimmed, retryId } });
      if (!isValidReceipt(receipt)) throw new MalformedFeedbackResponse();
      addSaved(receipt.post);
      attempt.current = null;
      setMessage(''); setCategory('');
      setStatus(receipt.replayed ? 'Already saved. Your post is on the board.' : 'Saved. Your post is now on the board.');
    } catch (error) {
      const described = describeError(error);
      if (described.kind === 'conflict' && attempt.current) attempt.current.conflicted = true;
      setSubmitError(described); setStatus('');
    } finally {
      inFlight.current = false; setBusy(false);
    }
  };

  const catErr = `${uid}-cat-err`, msgErr = `${uid}-msg-err`, msgHelp = `${uid}-msg-help`, notice = `${uid}-notice`;
  return <form className="feedback-form" onSubmit={onSubmit} noValidate aria-describedby={notice} data-testid="form-feedback">
    <div className="feedback-field">
      <label htmlFor={`${uid}-cat`}>Category <span aria-hidden="true">*</span></label>
      <select id={`${uid}-cat`} ref={categoryRef} required value={category} disabled={busy}
        aria-invalid={!!errors.category} aria-describedby={errors.category ? catErr : undefined}
        onChange={e => { setCategory(e.target.value as EventFeedbackCategory | ''); setErrors(x => ({ ...x, category: undefined })); setStatus(''); }}
        data-testid="select-feedback-category">
        <option value="" disabled>Choose a category</option>
        <option value="bug">Bug report</option>
        <option value="suggestion">Suggestion</option>
        <option value="general">General feedback</option>
      </select>
      {errors.category && <p id={catErr} className="feedback-error" role="alert">{errors.category}</p>}
    </div>
    <div className="feedback-field">
      <label htmlFor={`${uid}-msg`}>Message <span aria-hidden="true">*</span></label>
      <textarea id={`${uid}-msg`} ref={messageRef} required maxLength={MAX} rows={6} value={message} disabled={busy}
        aria-invalid={!!errors.message} aria-describedby={[msgHelp, errors.message ? msgErr : ''].filter(Boolean).join(' ')}
        onChange={e => { setMessage(e.target.value); setErrors(x => ({ ...x, message: undefined })); setStatus(''); }}
        data-testid="input-feedback-message" />
      <div className="feedback-help" id={msgHelp}><span>Plain text only. Be specific: what happened, where, and what you expected.</span><span data-testid="text-feedback-count">{message.length}/{MAX}</span></div>
      {errors.message && <p id={msgErr} className="feedback-error" role="alert">{errors.message}</p>}
    </div>
    <p className="feedback-notice" id={notice} data-testid="text-feedback-notice">Posts are shared on this board: other players and the developers can read them. Do not include passwords, emails, or other personal information. Developers read this same board; no response is promised.</p>
    {submitError && <div className="feedback-error feedback-error--block" role="alert" data-testid="status-feedback-error">
      <p>{submitError.text}</p>
      {submitError.kind === 'auth' && <Link href="/sign-in" className="feedback-link" data-testid="link-feedback-signin">Sign in again</Link>}
    </div>}
    <p className="feedback-status" role="status" aria-live="polite" data-testid="status-feedback">{status}</p>
    <button type="submit" className="feedback-submit" disabled={busy} aria-busy={busy} data-testid="button-feedback-submit">
      <Send size={15} aria-hidden="true" />{busy ? 'Sending...' : 'Submit feedback'}
    </button>
  </form>;
}

export function EventFeedbackFeed({ playerId }: { playerId: string }) {
  const feed = useEventFeedbackFeed(playerId);
  const posts = dedupePosts(feed.data);
  return <section className="feedback-feed" aria-labelledby="feedback-feed-title" aria-busy={feed.isFetching}>
    <div className="feedback-feed__head">
      <h4 id="feedback-feed-title">From the block</h4>
      <button type="button" className="feedback-ghost" onClick={() => feed.refetch()} disabled={feed.isFetching} data-testid="button-feedback-refresh"><RefreshCw size={13} aria-hidden="true" />Refresh</button>
    </div>
    {feed.isPending ? <ul className="feedback-list" aria-label="Loading feedback">{[0, 1, 2].map(i => <li key={i} className="feedback-post feedback-post--skeleton" aria-hidden="true"><i /><i /><i /></li>)}</ul>
      : feed.isError && posts.length === 0 ? <div className="feedback-empty" role="alert" data-testid="status-feed-error"><p>The shared feed did not load.</p><button type="button" className="feedback-ghost" onClick={() => feed.refetch()} data-testid="button-feed-retry">Try again</button></div>
      : posts.length === 0 ? <div className="feedback-empty" data-testid="status-feed-empty"><MessageSquareText size={22} aria-hidden="true" /><p>No notes pinned yet. Yours could be the first.</p></div>
      : <ul className="feedback-list">{posts.map(post => <FeedPost key={post.id} post={post} />)}</ul>}
    {feed.isFetchNextPageError && <p className="feedback-error" role="alert">Older posts did not load. Try again.</p>}
    {feed.hasNextPage && <button type="button" className="feedback-ghost feedback-more" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage} data-testid="button-feed-more">{feed.isFetchingNextPage ? 'Loading...' : 'Load more'}</button>}
  </section>;
}

function FeedPost({ post }: { post: EventFeedbackPost }) {
  return <li className={`feedback-post feedback-post--${post.category}`} data-testid={`card-feedback-${post.id}`}>
    <div className="feedback-post__meta"><b>{post.displayName}</b><span>{CATEGORY_LABEL[post.category]}</span><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></div>
    <p>{post.message}</p>
  </li>;
}

export function EventFeedbackSection({ playerId }: { playerId: string }) {
  return <section id={FEEDBACK_SECTION_ID} className="bulletin-section feedback-section" aria-labelledby="feedback-title" tabIndex={-1}>
    <div className="bulletin-section__title bulletin-section__title--red"><span>03</span><div><small>Pin a note for the dev room</small><h3 id="feedback-title">Send feedback to the devs</h3></div></div>
    <div className="feedback-grid">
      <EventFeedbackForm playerId={playerId} />
      <EventFeedbackFeed playerId={playerId} />
    </div>
  </section>;
}

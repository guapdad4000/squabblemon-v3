import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, ClipboardList, Copy, Plus, RefreshCw } from 'lucide-react';
import type { AdminPatch, PatchInput } from '@workspace/api-client-react';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { PatchArt, PatchDetail } from '../../components/PatchNotes';
import { useAdminPatches, usePatchActions, usePatchPreview } from '../../hooks/use-patches';
import { useAppAuth } from '../../lib/auth';
import { PREPARED_PATCHES } from '../../lib/preparedPatches';
import '../../styles/patches.css';

type DraftForm = Required<Omit<PatchInput, 'artCardId'>> & { artCardId: string | null };
const blank = (): DraftForm => ({ version: '', title: '', date: new Date().toISOString().slice(0, 10), overview: '', buffs: [], changes: [], softCurrency: 50, packTickets: 0, artCardId: null });
const fromPatch = (patch: AdminPatch): DraftForm => ({ version: patch.version, title: patch.title, date: patch.date, overview: patch.overview, buffs: patch.buffs, changes: patch.changes, softCurrency: patch.softCurrency, packTickets: patch.packTickets, artCardId: patch.artCardId ?? null });
/** Only original character portraits can headline a patch; supports and tokens are excluded. */
const artChoices = cardCatalog.filter(card => card.kind !== 'support' && card.kind !== 'token')
  .map(card => ({ id: card.catalogId, name: card.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const reward = (clout: number, tickets: number) => `${clout} Clout, ${tickets} Pack ${tickets === 1 ? 'Ticket' : 'Tickets'}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function PatchDesk() {
  const admin = useAdminPatches();
  const { save, publish, deliver } = usePatchActions();
  const auth = useAppAuth();
  // Clerk exposes the signed-in user ID; the local test-auth shim does not.
  const userId = 'userId' in auth && typeof auth.userId === 'string' ? auth.userId : '';
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(blank);
  const [buffText, setBuffText] = useState('');
  const [changeText, setChangeText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const loadedStamp = useRef('');
  const patches = admin.data ?? [];
  const selected = patches.find(p => String(p.id) === selectedId);
  const preview = usePatchPreview(selectedId, previewOpen && selected?.status === 'draft', selected?.updatedAt);
  useEffect(() => {
    if (!selected || dirty || loadedStamp.current === selected.updatedAt) return;
    loadedStamp.current = selected.updatedAt;
    const next = fromPatch(selected);
    setForm(next); setBuffText(next.buffs.join('\n')); setChangeText(next.changes.join('\n'));
    setPreviewOpen(false);
  }, [selected, dirty]);
  useEffect(() => {
    if (confirmOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!confirmOpen && dialog.current?.open) dialog.current.close();
  }, [confirmOpen]);
  const load = (patch?: AdminPatch) => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    setSelectedId(patch ? String(patch.id) : null);
    const next = patch ? fromPatch(patch) : blank();
    loadedStamp.current = patch?.updatedAt ?? '';
    setForm(next); setBuffText(next.buffs.join('\n')); setChangeText(next.changes.join('\n'));
    setDirty(false); setPreviewOpen(false); setConfirmOpen(false); setNotice('');
    save.reset(); publish.reset(); deliver.reset();
  };
  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm(current => ({ ...current, [key]: value })); setDirty(true); setPreviewOpen(false); setNotice(''); save.reset();
  };
  const parseLines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
  const payload = (): DraftForm => ({ ...form, version: form.version.trim(), title: form.title.trim(), overview: form.overview.trim(), buffs: parseLines(buffText), changes: parseLines(changeText), softCurrency: Number(form.softCurrency), packTickets: Number(form.packTickets) });
  const saveDraft = (event: FormEvent) => {
    event.preventDefault();
    if (selected?.status === 'published') return;
    const input = payload();
    if (!input.version || !input.title || !input.date || !input.overview || !Number.isInteger(input.softCurrency) || input.softCurrency < 0 || input.softCurrency > 100 || !Number.isInteger(input.packTickets) || input.packTickets < 0 || input.packTickets > 1) return;
    save.mutate({ id: selectedId ?? undefined, input }, {
      onSuccess: result => {
        loadedStamp.current = result.updatedAt;
        const saved = fromPatch(result);
        setForm(saved); setBuffText(saved.buffs.join('\n')); setChangeText(saved.changes.join('\n'));
        setDirty(false); setSelectedId(String(result.id)); setNotice('Draft saved. Preview the Events note and letter before publication.');
      },
    });
  };
  const missingPrepared = PREPARED_PATCHES.filter(prepared => !patches.some(patch => patch.version === prepared.version));
  /** Adds the prepared notes as ordinary drafts. Each still needs its own preview and typed confirmation. */
  const importPrepared = async () => {
    if (importing || !missingPrepared.length) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    setImporting(true); setNotice(''); save.reset();
    let added = 0;
    try {
      for (const prepared of missingPrepared) {
        await save.mutateAsync({ input: prepared });
        added++;
      }
      setNotice(`Added ${added} prepared ${added === 1 ? 'draft' : 'drafts'}. Open each one, preview the letter and audience, then publish oldest first so the newest note lands on top.`);
    } catch {
      setNotice(`Added ${added} of ${missingPrepared.length} prepared drafts before the desk stopped. Refresh, then try again to add the rest.`);
    } finally {
      setImporting(false); void admin.refetch();
    }
  };
  const copyUserId = async () => {
    if (!userId) return;
    try { await navigator.clipboard.writeText(userId); setCopied(true); } catch { setCopied(false); }
  };
  const openPreview = () => { publish.reset(); setPreviewOpen(true); setNotice(''); };
  const publishDraft = () => {
    if (!selectedId || !preview.data || preview.isFetching || confirmation !== preview.data.patch.version || dirty) return;
    publish.mutate({ id: selectedId, updatedAt: preview.data.patch.updatedAt }, {
      onSuccess: () => { setConfirmOpen(false); setConfirmation(''); setPreviewOpen(false); setNotice('Published. Delivery has started; watch the count below.'); },
      onError: () => {
        setConfirmOpen(false); setConfirmation(''); setPreviewOpen(false);
        setNotice('Publication was not completed. The draft may have changed; refresh it, then inspect a new preview before trying again.');
        void admin.refetch();
      },
    });
  };

  return <main className="patch-desk" data-testid="page-patch-desk"><div className="patch-desk__inner">
    <nav className="patch-desk__nav" aria-label="Patch desk navigation"><Link href="/game/events"><ArrowLeft size={14} aria-hidden="true" /> Events board</Link><Link href="/game">Safehouse <ArrowRight size={14} aria-hidden="true" /></Link></nav>
    <header className="patch-desk__mast"><small>SAFEHOUSE / PRIVATE DESK</small><h1>Patch desk.</h1><p>Write the note. Inspect the mail. Publish only when the block is ready.</p></header>
    {admin.isPending ? <div className="patch-desk__layout" role="status" aria-label="Checking desk access"><div className="patch-skeleton" /><div className="patch-skeleton" /></div> :
      admin.isError ? <div className="patch-state patch-state--error" role="alert" style={{ marginTop: 20 }}><strong>Desk unavailable.</strong> Access is restricted, or the desk could not be reached. No drafts are shown. <button type="button" data-testid="button-retry-admin" onClick={() => void admin.refetch()}>Try again</button>
        {userId && <p className="patch-desk__account" data-testid="text-admin-account">To request access, give the site owner this account ID to add to <code>PATCH_ADMIN_USER_IDS</code>: <code data-testid="text-admin-user-id">{userId}</code> <button type="button" onClick={() => void copyUserId()} data-testid="button-copy-user-id"><Copy size={13} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}</button></p>}</div> :
      <div className="patch-desk__layout">
        <aside className="patch-desk__rail"><h2>On the desk</h2><button type="button" className="patch-button" onClick={() => load()} data-testid="button-new-patch"><Plus size={15} aria-hidden="true" /> New draft</button>
          {!patches.length && <p>No drafts yet. Start with the version and a clear summary.</p>}
          {patches.map(patch => <button key={patch.id} type="button" aria-current={selectedId === String(patch.id) ? 'true' : undefined} onClick={() => load(patch)} data-testid={`button-edit-patch-${patch.id}`}><small>{patch.status} / {patch.version}</small><strong>{patch.title}</strong></button>)}
          {missingPrepared.length > 0 && <div className="patch-prepared" data-testid="panel-prepared-patches"><p><strong>{missingPrepared.length} prepared {missingPrepared.length === 1 ? 'note' : 'notes'}</strong> from recent passes ({missingPrepared.map(item => item.version).join(', ')}), each with character art and 100 Clout + 1 Pack Ticket. Adding them only creates drafts.</p>
            <button type="button" className="patch-button patch-button--light" onClick={() => void importPrepared()} disabled={importing} data-testid="button-import-prepared"><ClipboardList size={14} aria-hidden="true" /> {importing ? 'Adding…' : 'Add prepared drafts'}</button></div>}
          <button type="button" className="patch-button patch-button--light" onClick={() => void admin.refetch()} disabled={admin.isFetching} data-testid="button-refresh-admin"><RefreshCw size={14} aria-hidden="true" /> Refresh counts</button>
        </aside>
        <section className="patch-desk__work" aria-labelledby="patch-work-title">
          <h2 id="patch-work-title">{selected ? `${selected.status === 'published' ? 'Published' : 'Draft'} / ${selected.version}` : 'New draft'}</h2>
          {selected?.status === 'published' && <div className="patch-progress" role="status"><strong>Delivery: {selected.deliveredCount} / {selected.intendedCount}</strong><span>{selected.failedCount} failed · {selected.intendedCount - selected.deliveredCount - selected.failedCount} remaining</span>{selected.lastError && <p>Last error: {selected.lastError}</p>}<p>Published copy is locked. Retrying delivers only outstanding letters; it does not publish a second patch.</p><button className="patch-button" type="button" onClick={() => deliver.mutate(String(selected.id), { onSuccess: () => setNotice('Delivery retry requested. Refreshing progress.') })} disabled={deliver.isPending || (selected.failedCount === 0 && selected.deliveredCount >= selected.intendedCount)} data-testid="button-retry-delivery">{deliver.isPending ? 'Requesting…' : 'Retry outstanding delivery'}</button></div>}
          {selected?.status !== 'published' ? <form className="patch-form" onSubmit={saveDraft} data-testid="form-patch">
            <div className="patch-form__row"><label>Version<input required maxLength={50} value={form.version} onChange={e => update('version', e.target.value)} placeholder="e.g. 1.4.2" data-testid="input-patch-version" /></label><label>Display date<input required type="date" value={form.date} onChange={e => update('date', e.target.value)} data-testid="input-patch-date" /></label><label>Title<input required maxLength={150} value={form.title} onChange={e => update('title', e.target.value)} placeholder="What's changed?" data-testid="input-patch-title" /></label></div>
            <div className="patch-desk__art"><label>Character art<select value={form.artCardId ?? ''} onChange={e => update('artCardId', e.target.value || null)} data-testid="select-patch-art"><option value="">No artwork</option>{artChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label><PatchArt cardId={form.artCardId} size="thumb" /></div>
            <label>Overview<textarea required value={form.overview} onChange={e => update('overview', e.target.value)} placeholder="A short, player-facing introduction." data-testid="input-patch-overview" /></label>
            <label>Buffs · one per line<textarea value={buffText} onChange={e => { setBuffText(e.target.value); setDirty(true); setPreviewOpen(false); }} placeholder="Who got stronger, and how?" data-testid="input-patch-buffs" /></label>
            <label>Other changes · one per line<textarea value={changeText} onChange={e => { setChangeText(e.target.value); setDirty(true); setPreviewOpen(false); }} placeholder="Rules, fixes, and everything else." data-testid="input-patch-changes" /></label>
            <div className="patch-form__row"><label>Clout per letter · max 100<input type="number" min="0" max="100" step="1" required value={form.softCurrency} onChange={e => update('softCurrency', Number(e.target.value))} data-testid="input-patch-clout" /></label><label>Pack tickets per letter · max 1<input type="number" min="0" max="1" step="1" required value={form.packTickets} onChange={e => update('packTickets', Number(e.target.value))} data-testid="input-patch-tickets" /></label></div>
            <div className="patch-form__actions"><button className="patch-button" type="submit" disabled={save.isPending} data-testid="button-save-patch">{save.isPending ? 'Saving…' : selectedId ? 'Save changes' : 'Create draft'}</button>{selectedId && <button className="patch-button patch-button--light" type="button" disabled={dirty || save.isPending} onClick={openPreview} data-testid="button-preview-patch">Preview mail & audience</button>}</div>
          </form> : <div className="patch-detail"><div className={`patch-detail__head${selected.artCardId ? ' patch-detail__head--art' : ''}`}><div><span className="patch-detail__eyebrow">Published copy</span><h4>{selected.title}</h4><p>{selected.overview}</p></div><PatchArt cardId={selected.artCardId} /></div><div className="patch-detail__columns"><section><h5>Buffs</h5><ul>{selected.buffs.map((line, i) => <li key={i}>{line}</li>)}</ul></section><section><h5>Changes</h5><ul>{selected.changes.map((line, i) => <li key={i}>{line}</li>)}</ul></section></div><p className="patch-detail__delivery">Reward: {reward(selected.softCurrency, selected.packTickets)} per delivered letter.</p></div>}
          {notice && <p role="status" className="patch-state">{notice}</p>}
          {(save.isError || publish.isError || deliver.isError) && <p className="patch-state patch-state--error" role="alert">{errorMessage(save.error ?? publish.error ?? deliver.error)}</p>}
          {previewOpen && selected?.status === 'draft' && <div className="patch-preview" aria-labelledby="patch-preview-title"><h3 id="patch-preview-title">Before it goes out</h3>
            {preview.isPending || preview.isFetching ? <div className="patch-skeleton" role="status" aria-label="Loading preview" /> : preview.isError ? <div role="alert" className="patch-state patch-state--error">Preview could not be loaded. <button type="button" onClick={() => void preview.refetch()}>Retry preview</button></div> : preview.data && <>
              <PatchDetail patch={preview.data.patch} preview />
              <div className="patch-preview__letter"><small>FROM {preview.data.letter.sender}</small><h3>{preview.data.letter.title}</h3><p>{preview.data.letter.body}</p></div>
              <p className="patch-preview__stats">Audience: {preview.data.audienceCount.toLocaleString()} players<br />Each letter: {reward(preview.data.letter.gift.softCurrency, preview.data.letter.gift.packTickets)}, {preview.data.letter.gift.styleShards} Style Shards.<br />Players who join later receive the same letter the next time they open the game.</p>
              <button type="button" className="patch-button patch-button--danger" onClick={() => setConfirmOpen(true)} data-testid="button-open-publish">Review publication</button>
            </>}
          </div>}
        </section>
      </div>}
    <dialog ref={dialog} className="patch-confirm" aria-labelledby="patch-confirm-title" onCancel={e => { e.preventDefault(); setConfirmOpen(false); setConfirmation(''); }}>
      {preview.data && <><h2 id="patch-confirm-title">Publish {preview.data.patch.version}?</h2><p>This pins the patch publicly and starts mail delivery to <strong>{preview.data.audienceCount.toLocaleString()} players</strong>. Each letter carries <strong>{reward(preview.data.letter.gift.softCurrency, preview.data.letter.gift.packTickets)} and {preview.data.letter.gift.styleShards} Style Shards</strong>. Players who join later receive it on their next visit. Published copy cannot be edited.</p>
        <label>Type <strong>{preview.data.patch.version}</strong> to confirm<input autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} data-testid="input-confirm-version" /></label>
        {publish.isError && <p role="alert">{errorMessage(publish.error)}</p>}
        <div className="patch-confirm__actions"><button className="patch-button patch-button--light" type="button" onClick={() => { setConfirmOpen(false); setConfirmation(''); }} data-testid="button-cancel-publish">Not yet</button><button className="patch-button patch-button--danger" type="button" disabled={confirmation !== preview.data.patch.version || publish.isPending} onClick={publishDraft} data-testid="button-confirm-publish">{publish.isPending ? 'Publishing…' : 'Publish & deliver'}</button></div></>}
    </dialog>
  </div></main>;
}
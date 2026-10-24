/** Keep native browser chrome out of the game, including body-portalled dialogs. */
const copyText = '[data-native-selection], .ff-code strong, .fa-session__code strong, .online-room-code strong, .sq-code';
const nativeText = `input, textarea, select, [role="textbox"], ${copyText}`;
const installed = new WeakMap<Document, { users: number; remove: () => void }>();

function targetElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
}
function preservesNativeText(element: Element | null): boolean {
  if (!element) return false;
  if (element.closest(nativeText)) return true;
  const editable = element.closest('[contenteditable]');
  return Boolean(editable && editable.getAttribute('contenteditable') !== 'false');
}

export function installGameSurfacePolicy(doc: Document = document): () => void {
  let entry = installed.get(doc);
  if (!entry) {
    const previous = doc.documentElement.getAttribute('data-game-surface');
    doc.documentElement.setAttribute('data-game-surface', 'active');
    const preventNativeUI = (event: Event) => {
      if (!preservesNativeText(targetElement(event.target))) event.preventDefault();
      // Do not stop propagation: the card's own right-click inspection still runs.
    };
    const preventImageDrag = (event: Event) => {
      const target = targetElement(event.target);
      if (!target || preservesNativeText(target)) return;
      // Story's explicit reorder handles retain native drag-and-drop.
      const handle = target.closest('[draggable="true"]');
      if (handle && !handle.matches('img, a')) return;
      if (target.closest('img, a[href], svg, canvas, video')) event.preventDefault();
    };
    doc.addEventListener('contextmenu', preventNativeUI, true);
    doc.addEventListener('selectstart', preventNativeUI, true);
    doc.addEventListener('dragstart', preventImageDrag, true);
    entry = { users: 0, remove: () => {
      doc.removeEventListener('contextmenu', preventNativeUI, true);
      doc.removeEventListener('selectstart', preventNativeUI, true);
      doc.removeEventListener('dragstart', preventImageDrag, true);
      if (previous === null) doc.documentElement.removeAttribute('data-game-surface');
      else doc.documentElement.setAttribute('data-game-surface', previous);
      installed.delete(doc);
    } };
    installed.set(doc, entry);
  }
  entry.users++;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (--entry.users === 0) entry.remove();
  };
}

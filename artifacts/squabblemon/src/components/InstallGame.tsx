import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallGame({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setInstalled(
        standalone.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const completed = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    check();
    standalone.addEventListener("change", check);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    return () => {
      standalone.removeEventListener("change", check);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setHelp(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (installed) return null;
  return (
    <>
      <button
        type="button"
        className={`min-h-12 inline-flex items-center justify-center gap-2 border border-white/20 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-white/5 ${className}`}
        disabled={busy}
        onClick={() => void install()}
      >
        <Download size={16} /> {busy ? "Opening install…" : "Install game"}
      </button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md border-amber-200/30 bg-[#12110f] text-white">
          <Smartphone className="text-amber-200" size={28} />
          <DialogTitle>Bring the block to your home screen.</DialogTitle>
          <DialogDescription className="text-white/70">
            Install Squabblemon from your browser. Your crew stays with your
            account. An internet connection is required for online play.
          </DialogDescription>
          <div className="space-y-4 text-sm leading-relaxed text-white/80">
            <p>
              <strong className="text-amber-200">iPhone or iPad:</strong> Open
              this site in Safari, tap Share, then Add to Home Screen. If shown,
              leave Open as Web App enabled and tap Add.
            </p>
            <p>
              <strong className="text-amber-200">Android:</strong> Open this
              site in Chrome, tap the three-dot menu, then Install app or Add to
              Home screen.
            </p>
            <p>
              <strong className="text-amber-200">Computer:</strong> Look for the
              install icon in the address bar, or use your browser's app
              installation menu.
            </p>
            <p className="text-xs text-white/50">
              Opened this link inside a chat app? Use its menu to open it in
              Safari or Chrome first.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

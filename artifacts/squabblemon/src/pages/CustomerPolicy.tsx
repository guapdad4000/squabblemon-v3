import { useEffect } from 'react';
import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';

const SUPPORT_EMAIL = 'Guapshipping@gmail.com';
const MERCHANT_NAME = 'It’s a check inc';
// Set only as part of the authorized live-launch release, never from a test
// checkout or from the date this draft was prepared.
export const POLICY_EFFECTIVE_DATE: string | null = null;
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Squabblemon Clout purchase support')}`;

function usePolicyMetadata(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionTag?.content;
    const openGraphTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const previousOpenGraphTitle = openGraphTitle?.content;
    const openGraphDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const previousOpenGraphDescription = openGraphDescription?.content;

    document.title = title;
    if (descriptionTag) descriptionTag.content = description;
    if (openGraphTitle) openGraphTitle.content = title;
    if (openGraphDescription) openGraphDescription.content = description;

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== undefined) descriptionTag.content = previousDescription;
      if (openGraphTitle && previousOpenGraphTitle !== undefined) openGraphTitle.content = previousOpenGraphTitle;
      if (openGraphDescription && previousOpenGraphDescription !== undefined) openGraphDescription.content = previousOpenGraphDescription;
    };
  }, [description, title]);
}

function PolicyShell({ children, eyebrow, title, description }: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="h-[100dvh] overflow-y-auto bg-[#070707] text-white font-sans">
      <div className="noise-overlay" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_82%_8%,rgba(250,204,21,.12),transparent_35%),linear-gradient(135deg,#070707_0%,#10100c_50%,#070707_100%)]" />
      <div className="relative mx-auto w-full max-w-5xl px-5 py-6 md:px-10 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link
            href="/"
            data-testid="link-policy-home"
            className="inline-flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-white/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to Squabblemon
          </Link>
          <nav className="flex items-center gap-4" aria-label="Customer policies">
            <Link href="/support" data-testid="link-policy-support" className="font-mono text-[10px] uppercase tracking-widest text-primary hover:text-yellow-200">
              Support
            </Link>
            <Link href="/refund-policy" data-testid="link-policy-refunds" className="font-mono text-[10px] uppercase tracking-widest text-primary hover:text-yellow-200">
              Refund policy
            </Link>
          </nav>
        </header>

        <section className="border-b border-white/10 py-10 md:py-14">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[.28em] text-primary">{eyebrow}</p>
          <h1 data-testid="heading-policy-title" className="max-w-3xl font-display text-4xl font-black uppercase italic leading-[.95] md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">{description}</p>
          <div data-testid="status-policy-draft" className="mt-6 inline-flex items-center gap-2 border border-amber-300/30 bg-amber-300/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-200">
            <ShieldCheck size={15} aria-hidden="true" /> {POLICY_EFFECTIVE_DATE
              ? `Effective ${POLICY_EFFECTIVE_DATE}`
              : 'Owner-approved for launch · Not yet effective'}
          </div>
        </section>

        <div className="grid gap-8 py-9 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-12">
          <article className="space-y-8 text-sm leading-7 text-white/72">
            {children}
          </article>
          <aside className="h-fit border border-white/10 bg-white/[.035] p-5 md:sticky md:top-6">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-white/45">Merchant</p>
            <p data-testid="text-merchant-name" className="mt-2 font-display text-xl font-bold text-white">{MERCHANT_NAME}</p>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[.2em] text-white/45">Purchase support</p>
            <a
              href={SUPPORT_MAILTO}
              data-testid="link-support-email-aside"
              className="mt-2 block break-all text-sm font-bold text-primary hover:text-yellow-200"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-3 text-xs leading-5 text-white/45">This link opens your email app. It does not submit or send a request by itself.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-black uppercase italic text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function SupportPage() {
  usePolicyMetadata(
    'Squabblemon Purchase Support',
    'Owner-approved, pre-launch support information for Squabblemon Clout purchases.',
  );

  return (
    <PolicyShell
      eyebrow="Corner Store customer care"
      title="Clout purchase support"
      description="Help with a Clout order, delivery issue, duplicate charge, or refund request."
    >
      <Section title="Before you contact us">
        <p>Open <strong className="text-white">Fade Market → Your Orders</strong> and find the purchase you need help with. If a purchase is still processing, check its status there before attempting another payment.</p>
        <p>If payment completed but Clout has not arrived, contact support with the account’s order reference.</p>
      </Section>

      <Section title="What to include">
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Your Squabblemon order reference.</li>
          <li>A brief description of the problem.</li>
          <li>The approximate purchase date and whether the Clout was received or spent.</li>
        </ul>
        <p className="border-l-2 border-rose-400 bg-rose-400/5 px-4 py-3 text-rose-100">
          Never send your password, sign-in code, full card number, security code, or payment credentials. Support may ask you to verify control of the purchasing account through a secure process.
        </p>
      </Section>

      <Section title="Contact purchase support">
        <p>Purchase support is monitored at <strong className="text-white">{SUPPORT_EMAIL}</strong>. We do not promise a response time.</p>
        <a
          href={SUPPORT_MAILTO}
          data-testid="link-open-email-app"
          className="inline-flex min-h-12 items-center gap-3 bg-primary px-5 font-display text-sm font-black uppercase italic text-black transition-colors hover:bg-yellow-300"
        >
          <Mail size={17} aria-hidden="true" /> Open your email app <ExternalLink size={14} aria-hidden="true" />
        </a>
        <p className="text-xs text-white/45">Opening this link does not send anything automatically. Review and send the message from your email app.</p>
      </Section>

      <Section title="Purchase availability">
        <p>Clout purchases are intended only for people aged 18 or older located in the United States. New checkout requires your age and location declarations. Hosted checkout also restricts new purchases using US IP geolocation. These controls are not proof of age or physical location, and hosted launch verification remains pending.</p>
      </Section>
    </PolicyShell>
  );
}

export function RefundPolicyPage() {
  usePolicyMetadata(
    'Squabblemon Refund Policy',
    'Owner-approved refund policy for Squabblemon Clout purchases, effective when live purchases launch.',
  );

  return (
    <PolicyShell
      eyebrow="Corner Store customer policy"
      title="Clout refunds"
      description={POLICY_EFFECTIVE_DATE
        ? `Voluntary refund terms effective ${POLICY_EFFECTIVE_DATE}. All rights provided by applicable law remain unchanged.`
        : 'Owner-approved voluntary refund terms, effective when live Clout purchases launch. Live purchases have not launched; no effective date has been set. All rights provided by applicable law remain unchanged.'}
    >
      <Section title="Clout purchases">
        <p>Clout is virtual currency for use within Squabblemon. It is not cash and cannot be withdrawn, transferred to another player, or exchanged for money.</p>
        <p>The store displays the bundle’s base price. Applicable tax is calculated during Stripe-hosted checkout, and Stripe displays the final total before payment. Squabblemon does not collect your full card details. Clout is added to the signed-in account only after payment is verified. Closing checkout or returning to the game does not itself confirm payment.</p>
        <p>Purchases are intended only for people aged 18 or older located in the United States. New checkout requires age and location declarations and hosted US IP geolocation. These are not proof of age or physical location; hosted launch verification remains pending.</p>
      </Section>

      <Section title="14-day voluntary request window">
        <p>When live purchases launch, we will accept refund requests made within <strong className="text-white">14 days of purchase</strong> for an <strong className="text-white">unused Clout bundle</strong>. This voluntary request window does not limit any rights or remedies available under applicable law.</p>
        <p>Duplicate charges, incorrect charges, undelivered purchases, and suspected unauthorized purchases will be investigated and corrected as appropriate.</p>
      </Section>

      <Section title="If Clout was spent">
        <p>If some or all of the purchased Clout has been spent, support will review the circumstances case by case. We do not guarantee a discretionary refund for a used bundle. Spending Clout does not remove any refund rights required by law.</p>
      </Section>

      <Section title="How approved refunds work">
        <p>Approved refunds are issued through Stripe to the original payment method where supported. Your bank or payment provider determines when the refund appears. We will not ask for another payment or your full card details to process a refund.</p>
        <p>A provider refund does not automatically remove Clout from your game wallet. Support will explain any proposed adjustment of refunded purchase entitlements separately. We will not silently remove earned rewards or create a negative balance.</p>
      </Section>

      <Section title="How to request review">
        <p>Email <a href={SUPPORT_MAILTO} data-testid="link-refund-email" className="font-bold text-primary hover:text-yellow-200">{SUPPORT_EMAIL}</a> with your account’s order reference, a brief description, the approximate purchase date, and whether the Clout was received or spent.</p>
        <p>Do not send passwords, sign-in codes, full card numbers, security codes, or any other payment credentials.</p>
      </Section>

      <Section title="Your legal rights">
        <p>Nothing in this policy limits mandatory consumer protections, legally required refunds, or your right to dispute a charge with your payment provider.</p>
      </Section>
    </PolicyShell>
  );
}
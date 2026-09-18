import { SignIn } from '@clerk/react';
import { e2eAuthEnabled, getAfterSignIn, TestAccountEntry } from '../../lib/auth';
import { basePath } from '../../lib/routing';
import { getCardImage } from '../../data';
import { AnimatedLogo } from '../../components/AnimatedLogo';

export function SignInPage() {
  if (e2eAuthEnabled) return <TestAccountEntry kind="sign-in" />;
  const redirectUrl = `${basePath}${getAfterSignIn()}`;
  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col items-center justify-center p-4 relative">
      <div className="noise-overlay" />
      <img src={getCardImage('gamer')} alt="" aria-hidden="true" className="fixed -left-[12%] bottom-[-10%] h-[72%] w-[52%] object-contain object-left-bottom opacity-30 grayscale pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <AnimatedLogo className="auth-logo" />
        <SignIn 
          appearance={{ elements: { logoBox: { display: 'none' } } }}
          path={`${basePath}/sign-in`}
          routing="path"
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={redirectUrl}
        />
      </div>
    </div>
  );
}

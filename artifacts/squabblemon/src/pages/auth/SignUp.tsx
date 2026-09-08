import { SignUp } from '@clerk/react';
import { e2eAuthEnabled, TestAccountEntry } from '../../lib/auth';
import { basePath } from '../../lib/routing';
import { getCardImage } from '../../data';

export function SignUpPage() {
  if (e2eAuthEnabled) return <TestAccountEntry kind="sign-up" />;
  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col items-center justify-center p-4 relative">
      <div className="noise-overlay" />
      <img src={getCardImage('live-streamer')} alt="" aria-hidden="true" className="fixed -right-[14%] bottom-[-9%] h-[74%] w-[54%] object-contain object-right-bottom opacity-30 grayscale pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <SignUp 
          path={`${basePath}/sign-up`}
          routing="path"
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/game`}
        />
      </div>
    </div>
  );
}
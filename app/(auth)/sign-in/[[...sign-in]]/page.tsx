import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <p className="rounded-lg border border-line bg-panel p-4 text-center text-sm leading-6 text-muted">
        Configure Clerk keys in <code className="text-foreground">.env.local</code> to enable
        authentication.
      </p>
    );
  }
  return <SignIn />;
}

import { TabBar } from "@/components/tab-bar";
import { requireOwner } from "@/lib/supabase/server";

// Planning and audio run inside server actions on these pages and can take a
// minute. 300 s is the Vercel Hobby ceiling with fluid compute.
export const maxDuration = 300;

export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  await requireOwner();
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-8 pb-32">{children}</main>
      <TabBar />
    </>
  );
}

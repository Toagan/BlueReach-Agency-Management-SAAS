import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NotAssignedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] p-6">
      {/* Background effects - blue/cyan gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl">
          {/* Clock icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <svg
                className="w-8 h-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Your dashboard is being set up
          </h1>

          {/* Description */}
          <p className="text-zinc-400 text-center mb-6">
            Your agency is preparing your portal. You&apos;ll get access as soon
            as they assign you.
          </p>

          {/* Email display */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6">
            <p className="text-sm text-zinc-500 mb-1">Signed in as</p>
            <p className="text-white font-medium break-all">{user.email}</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="block w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-center transition-colors border border-zinc-700 cursor-pointer"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/"
              className="block w-full py-3 px-4 text-zinc-400 hover:text-white font-medium rounded-xl text-center transition-colors"
            >
              Go to homepage
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-sm mt-6">
          Powered by Blue Reach
        </p>
      </div>
    </div>
  );
}

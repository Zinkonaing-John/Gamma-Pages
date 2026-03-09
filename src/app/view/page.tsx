"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function GammaViewer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get("url");
  const title = searchParams.get("title") || "Gamma Page";

  if (!url) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">No Gamma URL provided.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <button
          onClick={() => router.push("/")}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          &larr; Back
        </button>
        <h1 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Open in Gamma &rarr;
        </a>
      </div>

      {/* Embedded Gamma page */}
      <div className="flex-1">
        <iframe
          src={url}
          className="h-full w-full border-0"
          allow="fullscreen"
          loading="lazy"
          title={title}
        />
      </div>
    </div>
  );
}

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-zinc-500">Loading...</p>
        </div>
      }
    >
      <GammaViewer />
    </Suspense>
  );
}

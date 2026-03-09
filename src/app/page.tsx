"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface GammaPage {
  id: string;
  title: string;
  url: string;
}

const STORAGE_KEY = "gamma-embed-pages";

function loadPages(): GammaPage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePages(pages: GammaPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

export default function Home() {
  const router = useRouter();
  const [pages, setPages] = useState<GammaPage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPages(loadPages());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) savePages(pages);
  }, [pages, loaded]);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");

  function extractEmbedUrl(input: string): string {
    // Handle various Gamma URL formats:
    // https://gamma.app/docs/TITLE-xxxxxxxxxxxxx
    // https://gamma.app/public/TITLE-xxxxxxxxxxxxx
    // https://gamma.app/embed/xxxxxxxxxxxxx
    const trimmed = input.trim();

    // Already an embed URL
    if (trimmed.includes("gamma.app/embed/")) {
      return trimmed;
    }

    // Extract the ID from docs/public URLs
    const match = trimmed.match(/gamma\.app\/(?:docs|public)\/[^/]*?-?([a-z0-9]+)$/i);
    if (match) {
      return `https://gamma.app/embed/${match[1]}`;
    }

    // If it's just an ID
    if (/^[a-z0-9]+$/i.test(trimmed)) {
      return `https://gamma.app/embed/${trimmed}`;
    }

    // Return as-is if we can't parse it
    return trimmed;
  }

  function addPage() {
    if (!newUrl.trim()) return;
    const embedUrl = extractEmbedUrl(newUrl);
    const page: GammaPage = {
      id: Date.now().toString(),
      title: newTitle.trim() || "Untitled Gamma Page",
      url: embedUrl,
    };
    setPages([...pages, page]);
    setNewUrl("");
    setNewTitle("");
  }

  function removePage(id: string) {
    setPages(pages.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Gamma Embed
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Embed and view your Gamma presentations
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Add new Gamma page */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add a Gamma Page
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-48"
            />
            <input
              type="text"
              placeholder="Gamma URL or embed link"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPage()}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              onClick={addPage}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Paste a Gamma share link (e.g. https://gamma.app/docs/My-Page-abc123)
            or embed URL
          </p>
        </div>

        {/* Page list */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="group relative rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div
                className="cursor-pointer p-5"
                onClick={() =>
                  router.push(
                    `/view?url=${encodeURIComponent(page.url)}&title=${encodeURIComponent(page.title)}`
                  )
                }
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {page.title}
                </h3>
                <p className="mt-1 truncate text-xs text-zinc-400">
                  {page.url}
                </p>
              </div>
              <button
                onClick={() => removePage(page.id)}
                className="absolute right-2 top-2 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                title="Remove"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {pages.length === 0 && (
          <div className="py-20 text-center text-zinc-400">
            No Gamma pages added yet. Add one above to get started.
          </div>
        )}
      </main>
    </div>
  );
}

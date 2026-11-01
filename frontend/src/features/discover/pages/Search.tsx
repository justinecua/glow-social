import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search as SearchIcon, UserRound, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import PhotoDialog from "@/features/dashboard/components/modal/PhotoDialog";
import { useSearchQuery } from "@/redux/services/discover";
import PageHeader, { EmptyState } from "../components/PageHeader";
import PersonRow from "../components/PersonRow";
import PostCard from "../components/PostCard";

type Tab = "people" | "posts";

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("people");
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(
    null
  );
  const q = (params.get("q") ?? "").trim();

  // Debounce typing into the URL (?q=), which drives the query.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = input.trim();
      if (next !== q) setParams(next ? { q: next } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isFetching } = useSearchQuery({ q }, { skip: q.length < 2 });
  const people = data?.people ?? [];
  const posts = data?.posts ?? [];

  // Jump to whichever tab has results.
  useEffect(() => {
    if (!data) return;
    if (tab === "people" && people.length === 0 && posts.length > 0) setTab("posts");
    if (tab === "posts" && posts.length === 0 && people.length > 0) setTab("people");
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabBtn = (id: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`cursor-pointer border-b-2 px-1 pb-2 text-sm transition-colors ${
        tab === id
          ? "border-[var(--button-color-bg)] font-semibold text-[var(--title-color)]"
          : "border-transparent text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );

  return (
    <AppShell>
      <div className="w-full max-w-xl">
        <PageHeader title="Search" subtitle="Find people and posts on Glow." />

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtitle)]" />
          <input
            autoFocus
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by name, @username or post text"
            aria-label="Search"
            className="h-12 w-full rounded-xl border bg-[var(--home-card)] pl-10 pr-10 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {isFetching ? (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-subtitle)]" />
          ) : (
            input && (
              <button
                type="button"
                onClick={() => setInput("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)]"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        {q.length >= 2 && (
          data && (
            <>
              <div className="mt-6 flex gap-6 border-b">
                {tabBtn("people", "People", people.length)}
                {tabBtn("posts", "Posts", posts.length)}
              </div>

              <div className="mt-3">
                {tab === "people" &&
                  (people.length ? (
                    <div className="rounded-xl bg-[var(--home-card)] p-1">
                      {people.map((p: any) => (
                        <PersonRow key={p.id} person={p} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<UserRound className="h-5 w-5" />}
                      title={`No people match "${q}"`}
                    />
                  ))}

                {tab === "posts" &&
                  (posts.length ? (
                    posts.map((post: any) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onPhotoClick={(index) => setViewer({ photos: post.photos, index })}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={<SearchIcon className="h-5 w-5" />}
                      title={`No posts mention "${q}"`}
                    />
                  ))}
              </div>
            </>
          )
        )}

        <PhotoDialog
          isOpen={!!viewer}
          setIsOpen={(open: boolean) => !open && setViewer(null)}
          photos={viewer?.photos ?? []}
          selectedIndex={viewer?.index ?? 0}
        />
      </div>
    </AppShell>
  );
};

export default SearchPage;

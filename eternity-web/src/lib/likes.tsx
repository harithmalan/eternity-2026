import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useToast } from '../components/Toast';

const PENDING_LIKE_KEY = 'eternity:pending-like';

interface LikesContextValue {
  isLiked: (postId: string) => boolean;
  /** Batch-fetches "did I like this" for any of these ids not already known — never one query per card. */
  ensureLoaded: (postIds: string[]) => void;
  /** Bidirectional — the heart button. Returns the count delta actually applied, or null on failure (already reverted). */
  toggleLike: (postId: string) => Promise<{ delta: 1 | -1 } | null>;
  /** One-way — double-tap and the post-sign-in auto-apply. A no-op (returns null) if already liked. */
  likeOnly: (postId: string) => Promise<{ delta: 1 } | null>;
  /** Signed-out heart tap: remembers the post and opens sign-in with an explanatory line. */
  requestSignInThenLike: (postId: string) => void;
}

const LikesContext = createContext<LikesContextValue | null>(null);

export function useLikes(): LikesContextValue {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikes must be used within a LikesProvider');
  return ctx;
}

export function LikesProvider({ children }: { children: ReactNode }) {
  const { user, openSignIn } = useAuth();
  const { say } = useToast();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const loadedRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);

  // A sign-out (or a different account on a shared device) invalidates
  // everything cached so far — otherwise the previous visitor's likes would
  // leak into the next session.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== userIdRef.current) {
      userIdRef.current = uid;
      loadedRef.current = new Set();
      setLikedIds(new Set());
    }
  }, [user]);

  const ensureLoaded = useCallback(
    (postIds: string[]) => {
      if (!user) return;
      const unknown = postIds.filter((id) => !loadedRef.current.has(id));
      if (unknown.length === 0) return;
      unknown.forEach((id) => loadedRef.current.add(id));
      supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', unknown)
        .then(({ data, error }) => {
          if (error || !data) return;
          setLikedIds((prev) => {
            const next = new Set(prev);
            data.forEach((row) => next.add(row.post_id));
            return next;
          });
        });
    },
    [user]
  );

  const toggleLike = useCallback(
    async (postId: string): Promise<{ delta: 1 | -1 } | null> => {
      if (!user) return null;
      const wasLiked = likedIds.has(postId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });

      const { error } = wasLiked
        ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
        : await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });

      if (error) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        say("Couldn't save that like.");
        return null;
      }
      return { delta: wasLiked ? -1 : 1 };
    },
    [user, likedIds, say]
  );

  const likeOnly = useCallback(
    async (postId: string): Promise<{ delta: 1 } | null> => {
      if (!user || likedIds.has(postId)) return null;
      setLikedIds((prev) => new Set(prev).add(postId));
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        say("Couldn't save that like.");
        return null;
      }
      return { delta: 1 };
    },
    [user, likedIds, say]
  );

  const requestSignInThenLike = useCallback(
    (postId: string) => {
      try {
        sessionStorage.setItem(PENDING_LIKE_KEY, postId);
      } catch {
        // private mode — the like just won't auto-apply after sign-in
      }
      openSignIn('Sign in to like posts.');
    },
    [openSignIn]
  );

  // Fires once a session appears — covers both a same-page email/password
  // sign-in and a full-page OAuth redirect back to this exact URL.
  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_LIKE_KEY);
    } catch {
      return;
    }
    if (!pending) return;
    try {
      sessionStorage.removeItem(PENDING_LIKE_KEY);
    } catch {
      // best effort — worst case it tries again next sign-in
    }
    likeOnly(pending);
    // Only the arrival of a session should trigger this, not every time
    // `likeOnly` is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLiked = useCallback((postId: string) => likedIds.has(postId), [likedIds]);

  return (
    <LikesContext.Provider value={{ isLiked, ensureLoaded, toggleLike, likeOnly, requestSignInThenLike }}>
      {children}
    </LikesContext.Provider>
  );
}

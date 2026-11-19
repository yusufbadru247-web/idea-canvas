# Idea Canvas

An infinite board for notes, links, photos and videos. One HTML file, no build step.

- Double-click or double-tap the canvas to add a note.
- Paste or drop links, photos, videos and PDFs.
- Drag a card's round handle onto another card to connect them.
- Pinch or Ctrl/⌘ + scroll to zoom.

Opened from this site, boards are saved in the browser you use. Opened as a claude.ai artifact, they sync to your claude.ai account.

## Sync across devices (Supabase)

1. Create a free project at supabase.com.
2. SQL Editor > New query: paste `supabase/setup.sql`, then Run.
3. Authentication > URL Configuration: set Site URL to `https://yusufbadru247-web.github.io/idea-canvas/`.
4. Project Settings > API: copy the Project URL and the `anon` public key into `SUPABASE_URL` and `SUPABASE_KEY` at the top of the script in `index.html`.
5. Sign in once on the page, then turn off "Allow new users to sign up" (Authentication > Sign In / Providers) so nobody else can use your storage.

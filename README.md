# Field Notes

An inductive Bible study journal: pick a book, work through it chapter by chapter, and log the history, geography, promises and commands you find yourself. No scripture text included — you supply the observations.

It's a plain static site: one HTML file, one JS file, no build step, no server. Your notes save to your browser's local storage, so they'll be there next time you open the page **in the same browser on the same device**. There's no account and no sync between devices yet.

## Put it on GitHub Pages

1. Create a new repository on GitHub (e.g. `field-notes`). Public is fine — there's no personal data baked into the code.
2. Upload `index.html` and `app.js` from this folder to the repo (drag-and-drop on the GitHub website works, or `git add` / `git commit` / `git push` if you're using git locally).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch", pick your default branch (usually `main`) and the `/ (root)` folder, then **Save**.
5. GitHub gives you a URL like `https://<your-username>.github.io/field-notes/` — that's your live app. It can take a minute or two to go live the first time.

Add it to your phone's home screen the same way as any other web page (Safari: Share → Add to Home Screen; Chrome: ⋮ menu → Add to Home screen).

## If you want notes to sync across devices later

Right now notes are local-browser-only. If that becomes a problem, the next step (same pattern as the work-order app) is to add a small backend — Firebase is the simplest option — so notes save to the cloud instead of just the browser. That's a bigger change than this app currently has, so just ask when you're ready for it.

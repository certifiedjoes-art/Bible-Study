# Bible Study

An inductive Bible study journal: pick a book, work through it chapter by chapter, and break each one into your own titled sections — logging a one-sentence summary, the observations (places named included), promises, commands, and an open question you find yourself in each. No scripture text included — you supply the observations.

It's a plain static site: `index.html`, `app.js`, a `manifest.json`, and a few icon files — no build step, no server to run yourself. Notes are backed by a Firebase project (Firestore), so once you sign in with Google, your notes sync to the cloud and follow you across every device signed into that account. Without signing in, notes still work but save only to that browser's local storage.

## Put it on GitHub Pages

1. Create a new repository on GitHub (e.g. `bible-study`). Public is fine — the Firebase config in the code is meant to be public; access is locked down by Firestore's security rules, not by secrecy.
2. Upload **all** the files in this folder to the repo: `index.html`, `app.js`, `manifest.json`, and the `icon-*.png` files.
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch", pick your default branch (usually `main`) and the `/ (root)` folder, then **Save**.
5. GitHub gives you a URL like `https://<your-username>.github.io/bible-study/` — that's your live app. It can take a minute or two to go live the first time.

Add it to your phone's home screen the same way as any other web page (Safari: Share → Add to Home Screen; Chrome: ⋮ menu → Add to Home screen). Sign in with Google once on each device to get the same notes everywhere.

## Cloud sync (Firebase)

This app has its own dedicated Firebase project (`bible-study-8c876`), separate from the work-order app's project.

## Comparing notes with someone else

Once a second person signs in with their own Google account on this same app, you'll each see a "Viewing" dropdown appear in the Book panel, letting you pick the other person's name to read their notes (read-only — you can only edit your own). There's no invite step: anyone who signs in on the app shows up for everyone else to view.

Firestore security rules (see `firestore.rules`) let any signed-in Google account **read** every notebook (so notes can be compared) but only **write** to their own. In practice that means anyone who discovers the app's URL and signs in with a Google account can read everyone's notes, though they can't change anyone else's. Worth knowing since the URL is public, even though it's not easy to stumble onto by accident.

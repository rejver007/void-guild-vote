# VOID guild mark vote

A one-page vote for the new VOID guild mark in Cabal Online: 30 logo variations plus a "Keep the current logo" option. Each visitor gets one vote and can change it at any time. A live results table sits at the bottom of the page.

The site is static and hosted on GitHub Pages. Votes are stored in Firebase Cloud Firestore (free Spark plan), with one document per visitor keyed by an anonymous sign-in id.

## Connecting the vote counter

1. Create a project at <https://console.firebase.google.com> (Google Analytics is not needed).
2. **Build > Authentication > Get started > Sign-in method:** enable **Anonymous**.
3. **Authentication > Settings > Authorized domains:** add `rejver007.github.io`.
4. **Build > Firestore Database > Create database:** pick any location and start in **production mode**.
5. **Firestore > Rules:** replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
6. **Project settings > Your apps > Web (`</>`):** register an app, copy the `firebaseConfig` object, and paste it into [`firebase-config.js`](firebase-config.js) in place of `null`.

## Limits

One vote per browser. Someone who opens the page in another browser, on another device, or in a private window gets another vote. For a guild poll that's usually fine.

To reset the vote, delete the `votes` collection in the Firestore console.

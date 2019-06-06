# LinkedIn Profile to JSON Resume Bookmarklet

# Installation:
[link]

## What is JSON Resume?
"JSON Resume" is an open-source standard / schema, currently gaining in adoption, that standardizes the content of a resume into a shared underlying structure that others can use in automated resume formatters, parsers, etc. Read more about it [here](https://jsonresume.org/), or on [GitHub](https://github.com/jsonresume).

## What is this bookmarklet?
I made this because I wanted a way to quickly generate a JSON Resume export from my LinkedIn profile, and got frustrated with how locked down the LinkedIn APIs are and how slow it is to request your data export (up to 72 hours). "Install" the bookmarklet to your browser, then click to run it while looking at a LinkedIn profile (preferably your own), and my code will grab the various pieces of information off the page and then show a popup with the full JSON resume export that you can copy and paste to wherever you would like.

# Development
Currently, the build process looks like this:
 - `src/main.js` -> (`webpack + babel`) -> `build/main.js` -> [`mrcoles/bookmarklet`](https://github.com/mrcoles/bookmarklet) -> `build/bookmarklet_export.js` -> `build/install-page.html`
     - The bookmark can then be dragged to your bookmarks from the final `build/install-page.html`

All of the above should happen automatically when you do `npm run build`.

If this ever garners enough interest and needs to be updated, I will probably want to re-write it with TypeScript to make it more maintainable. 

# DISCLAIMER:
This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not resonsible for any misuse, or reprecussions of said misuse.
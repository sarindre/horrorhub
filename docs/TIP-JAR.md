# Tip jar: thinking for later

Not built, on purpose. This records the options and the rules to follow if HorrorHub ever asks for support.

## The open question
TMDb's terms say an app that is sold, or that generates revenue, needs a written commercial agreement. **Whether an optional tip counts as "commercial" is not stated anywhere I could find**, and forum posts say the safe reading is that any monetization does. Do not add a tip link until TMDb has answered in writing (the question is in [TMDB-EMAIL.md](TMDB-EMAIL.md)). If the answer is "tips are fine", this document is the plan. If it is "that is commercial", the real choices are the paid TMDb plan (reported at about $149 a month) or no tip jar.

## Where tips could come from
| Option | Notes |
| --- | --- |
| **GitHub Sponsors** | Lives on the repo you already have; no extra site |
| **Ko-fi / Buy Me a Coffee** | A simple page with one link; common for small apps |
| **itch.io pay-what-you-want** | If the desktop builds are published there, the price can be "name your price" |
| **Steam** | Has no tip jar. Support there means selling the app (or a supporter pack), which is the paid case |

Check each service's fees and rules before choosing (they change).

## Principles
- **Never gate a feature.** Everything stays free; a tip is thanks, not a purchase.
- **No nagging.** No pop-ups, no counters. One quiet link in Help or Settings → About.
- **No tracking.** The link opens the other site in the browser; HorrorHub learns nothing about who clicked.
- **Be specific about what it funds** (hosting is free today; real costs would be the TMDb license if needed, art, signing certificates and the Steam fee).
- **Keep it out of the Steam build** until Steam's rules on external payment or donation links are checked.
- **Separate it from data.** Never imply that tips buy TMDb data or that TMDb endorses the app.

## What to build, when the time comes
1. A `Support HorrorHub` card in Help (not on every screen) with one link and two sentences.
2. A build-time switch so the card is absent in the Steam build.
3. A line in the privacy policy ("the link opens a third-party site").
4. A note in the README and the store page copy.

## Triggers to revisit
- TMDb has answered in writing.
- There are real users asking how to support the app.
- A cost appears that tips would actually cover.

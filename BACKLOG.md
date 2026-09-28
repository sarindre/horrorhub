# HorrorHub Refresh Backlog

## Goal
Transform HorrorHub from a solid horror movie tracker into a more compelling, personalized horror discovery and planning app.

## Priority overview
- P0: Retain the current value of library management and import/export
- P1: Improve recommendation quality and horror-specific personalization
- P1: Add watch planning and themed marathon experiences
- P1: Add catalog intelligence for tags and filtering
- P2: Add retention features like seasonal challenges and streaks
- P2: Explore social-like curation without building a full social network

## Backlog items

### 1. Mood-based horror matching
Status: In Progress
Priority: P1

Create a feature that lets users discover horror based on emotional vibe and intensity rather than just title or genre.

Examples:
- atmospheric and slow-burn
- slasher energy
- shambling creature terror
- found-footage dread
- high-gore body horror
- bleak cosmic horror

Acceptance criteria:
- Users can filter by horror mood or intensity
- Recommendations align to watch vibe, not just metadata
- Mood choices are reflected in the library and suggestions UI

Implementation notes:
- Added a visible mood preset selector in the library and recommendations UI
- Library filtering now supports matching a selected horror vibe against tags
- Recommendation scoring boosts titles that match the chosen preset
- Added a Creature Feature preset and narrowed Body Horror to gore/body-horror/disturbing/sci-horror tags
- Added a "Max scares" intensity slider to the library filters (titles with no scare score stay visible)
- Mood-based picks heading now shows the active vibe and scare level
- Remaining: TMDb "similar" picks are not yet mood-aware; add a found-footage-style dread/cosmic tuning pass once tag data is richer

### 2. Smart recommendation engine
Status: Planned
Priority: P1

Expand the current hybrid recommendation approach into a more robust taste engine that learns from the user's horror preferences.

Ideas:
- weighted recommendations from ratings and watch history
- score based on tags, scares, mood, and subgenre
- suppress already-seen titles and avoid duplicates
- show “because you liked X” explanations

Acceptance criteria:
- Similar titles are generated using the user's watched + rated library
- Recommendations improve over time as more data is added
- The app explains why a suggestion is being made

### 3. Horror-specific watch planning
Status: Planned
Priority: P1

Add planning tools that help users build watch sessions and movie marathons.

Ideas:
- “Tonight’s watch” lane
- themed marathons by subgenre
- scare-level progression across a lineup
- runtime balancing
- seasonal watch recommendations

Acceptance criteria:
- Users can generate a curated watch sequence from library or recommendations
- Suggestions maintain pacing, mood, and intensity flow
- A watch plan can be exported or saved locally

### 4. Auto-tagging and catalog intelligence
Status: Planned
Priority: P1

Use movie metadata, user notes, and behavior to automatically infer tags instead of requiring manual entry for every movie.

Examples:
- folk horror
- body horror
- possession
- home invasion
- found footage
- occult
- slow-burn

Acceptance criteria:
- New titles are automatically assigned useful tags when metadata supports it
- Users can still refine or remove tags manually
- The tag system supports better searches and filtering

### 5. Content warnings and trigger filters
Status: Planned
Priority: P1

Add safer discovery controls for horror content to make the app feel thoughtful and user-friendly.

Examples:
- gore intensity
- body horror risk
- violence level
- animal harm warnings
- content advisories and spoiler flags

Acceptance criteria:
- Users can filter out titles that exceed preferred intensity limits
- Content warnings are visible before a title is added to a plan
- Filters reduce surprise and improve trust

### 6. Seasonal and challenge-based discovery
Status: Planned
Priority: P2

Introduce challenge loops and themed discovery streaks that keep the app engaging over time.

Ideas:
- 30 days of horror challenge
- cult classic month
- found-footage week
- late-night creature feature challenge

Acceptance criteria:
- Challenges are tied to user library or discovered titles
- Users can track completion and streak progress
- A challenge can generate a short watch list automatically

### 7. Curation layer without full social networking
Status: Planned
Priority: P2

Add lightweight social-style curation features without turning the app into a full social network.

Ideas:
- “Top picks for your horror mood”
- user-curated shelves
- recommended by subgenre
- shared watchlist themes

Acceptance criteria:
- Users can organize films into personal collections or shelves
- The app surfaces curated collections in a clean UI
- No heavy backend or account system is required for the first version

## Notes
The product should feel like a personal horror curator, not just a database. The strongest differentiator is a recommendation system that understands horror taste, mood, and watch planning.

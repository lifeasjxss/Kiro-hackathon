# AI Detective

**AI as a tool, not the answer.**

AI Detective is a free browser game for grades 6-8 (ages 11-14). Kids play a junior detective who reads an AI chatbot's answer, finds the one planted mistake, and learns a four-step routine called SPOT for checking AI answers. A teacher page shows anonymous, class-wide results.

**Play it:** https://lifeasjxss.github.io/Kiro-hackathon/hello-world-website/

- Teacher page: https://lifeasjxss.github.io/Kiro-hackathon/hello-world-website/teacher.html
- Source dashboard: https://lifeasjxss.github.io/Kiro-hackathon/hello-world-website/sources.html
- Demo video: [add link]
- Blog post: [add link]

[Add 1-2 screenshots here: a case screen and the teacher page]

---

## Project Overview

### Problem statement and target users

AI chatbots can sound confident and still be wrong, and kids in grades 6-8 are growing up with them. The lessons I reviewed teach kids to judge websites, posts, and scams, but I found almost none that let a middle schooler practice catching mistakes in an AI answer.

**Why this is within reach for me:** [Add 2-3 sentences in your own words: what you saw with your little brother or in your own life that made this a real problem.]

Target users: middle schoolers (ages 11-14) who play, and teachers who use it as a short classroom activity. It needs no accounts and works on school Chromebooks.

### Solution summary and key features

- **Case files with planted mistakes.** Each case shows a question and the Confident Bot's answer, which has exactly one planted mistake. Kids pick the mistake from multiple-choice phrases, so there is no typing anywhere.
- **Mistake types** match patterns researchers describe in real AI errors: invented authority, extreme numbers, no specifics, and overconfident tone. [Update if you added more types.]
- **SPOT toolkit.** Four tools on every case: **S**tep away from the chat, **P**ick your search words, **O**pen other sources, **T**est and decide. Each shows a tip written for that case.
- **Feedback that teaches.** A wrong answer gets a one-line reason why and a retry. A right answer unmasks the bot and names the mistake type.
- **"Need a clue?"** gives a nudge without giving the answer away.
- **End screen** with score, badges, and a printable certificate with a blank line for the kid's name.
- **Anonymous teacher page** showing which mistake types kids miss most and which SPOT tools they use.
- **Source dashboard** listing every cited source with its link and date accessed.

---

## Design Decisions

### Technology choices and alternatives considered

| Decision | What I chose | What I considered | Why |
| --- | --- | --- | --- |
| Front end | Plain HTML, CSS, and JavaScript with no build step | A framework such as React | Simple to host, easy to read, and nothing to break right before a deadline |
| AI answers | Pre-written cases, drafted by Kiro and reviewed by me | Live AI-generated cases | AI cannot reliably plant exactly one mistake on purpose, a live call adds cost and delay, and a child could see unreviewed output |
| Accounts | None | Student logins | Avoids collecting any child's data |
| Sound | Synthesized with the Web Audio API | Audio files | No files to license, and nothing to download |
| Fonts | Open-licensed fonts stored in `fonts/` | Linking fonts from Google | Keeps kids' browsers from contacting outside servers |
| Hosting | GitHub Pages | Amazon S3 and CloudFront | Fastest and gives HTTPS automatically. I first practiced static hosting on Amazon S3 with a Hello World page. [Update if you moved the game to S3 and CloudFront.] |

### Trade-offs

- **Simplicity vs. features.** I picked 6 of 25 researched ideas for the MVP and listed the rest as future work.
- **Pre-written vs. live cases.** Reliable and safe, but the case set is small, so replays repeat.
- **Anonymous vs. personalized.** No names means no per-student tracking, which protects kids but limits what a teacher can see.
- **Teacher data storage.** The anonymous counts are stored in the browser, so the teacher page only shows games played on that device and browser. It does not combine results from other computers. A real class-wide view needs shared storage, which I list as future work.

### Security, privacy, and scalability

- No accounts, no personal data, no typing boxes, and no tracking or analytics scripts.
- The teacher page stores anonymous totals only, with no names or individual results.
- No external fonts, scripts, or images, so a kid's browser talks only to the site itself.
- A reading-level rule and content rules (no politics, health advice, violence, or real private people) are written into the Steering file.
- **Scaling.** Static hosting handles many players cheaply. A real classroom-wide teacher view would need a shared back end, for example Lambda and DynamoDB, which I list as future work.

---

## Run it yourself

The game is plain HTML, CSS, and JavaScript with no build step. The files are in the `hello-world-website/` folder.

1. Download or clone this repo.
2. Open `hello-world-website/index.html` in a browser.
3. If the cases don't load when you open the file directly, run a simple local server from that folder (for example, `python -m http.server`) and open the address it prints.

To deploy, turn on GitHub Pages for the `main` branch. The site updates each time you push.

---

## Kiro Usage

The `.kiro/` folder holds the Steering file, the Specs, and the Hook.

**Steering.** I wrote `.kiro/steering/product.md` before building. It sets the audience (grades 6-8 at about a 6th-grade reading level), tone, privacy rules, accessibility rules, the SPOT routine, the detective theme, and a list of what is out of scope. The strategy that worked was putting rules I never wanted broken in one place, so I did not have to repeat them in every prompt. Kiro turned the reading-level rule into an automated test, which exposed strings that were too hard. [Confirm: when the test's 5.0-7.0 range flagged strings, I changed it to a grade-8 ceiling with no minimum.]

**Spec-driven development.** I gave Kiro the six MVP features plus the source dashboard in Spec mode. It produced requirements, a design, and a task list of about 14 tasks. I read each stage and checked it against my privacy rules before approving. Compared with vibe coding, specs gave me a plan I could check and tick off, which suited the core build. [Add one specific moment where the Spec caught or shaped something.]

**Agent hooks.** I made `cases-review-on-save`. When `data/cases.json` is saved, Kiro checks that every case has exactly one planted mistake, a decoys field, a one-line why, and real sources, flags anything uncertain with `needsReview` instead of inventing a source, and keeps `docs/source-log.md` in sync. I chose it because the cases are the heart of the game and AI can invent sources that look real.

**Vibe coding (chat).** I used regular chat for focused changes after the core build, such as the font setup, color theme, sound, certificate, and SPOT tool fixes. Each prompt asked for a short plan first and listed what not to change (scoring, game logic, data collection). [Add your best code-generation moment.]

**MCP.** I did not use MCP in this project. [Optional: say what you would connect in a future version.]

**Models.** I used a stronger Opus model for the Spec, because requirements and design shape everything after, and a cheaper Sonnet model for most build tasks.

All code in this repo was built in Kiro. Research and planning were supported by Claude, an AI assistant from Anthropic. I reviewed every case and opened every source link myself.

---

## Learning Journey and Forward Thinking

**Biggest challenges**
- **Repeated patterns in the cases.** Playtesting showed the planted mistake was always in the same spot, which let kids guess by position. I added a plan for different positions, shapes, and confident voices, and rewrote the cases.
- **Making the cases trustworthy.** AI can invent sources, so I checked each link and used the hook to flag anything uncertain.
- **Deploying.** My early commits never reached GitHub, so the live site showed old files. I learned how commits and pushes work.
- **Feeling like a detective.** Playtesters said the look said detective but the play did not yet feel like investigating. [Add what you changed, or say it is future work.]

**Feedback received.** Two testers so far: an 11-year-old who just started 6th grade, and an adult in his 60s who works in the financial industry. Both liked the design and said the colors look like a detective game. Both said, separately, that the gameplay should feel more like investigating, with clues, suspicious details, and evidence for deciding whether an answer can be trusted.

**What I would do differently**
- Test with real kids earlier, before polishing visuals.
- Write a "confident voice" guide before generating cases.
- Practice the full commit and push loop earlier.
- Build something myself without AI first, to understand it better, then use AI to review it.

**Skills gained:** reading and checking AI output, writing steering docs and specs, basic Git and static hosting, and checking accessibility and color contrast.

**Resources that helped:** Common Sense Education lessons, Google's Interland (Reality River), Kiro's documentation, and research on AI-generated citations.

**Future enhancements**
- Evidence pinning: tap sentences in the answer to mark them as suspicious, and pin evidence cards from SPOT tools.
- A practice round followed by a final case with new examples, plus Rookie-to-Chief levels and badges per mistake type.
- More mistake types, such as near-miss names and precise numbers with no source.
- Shared, anonymous class results through AWS (for example, Lambda and DynamoDB).
- Live-generated cases with teacher review.
- Optional named accounts for schools, only with consent and a privacy review.
- A full migration to Amazon S3 and CloudFront with HTTPS.

---

## Sources and credits

- The full source list, with links and dates accessed, is in `docs/source-log.md` and on the source dashboard page.
- The game format is inspired by Google's [Interland: Reality River](https://beinternetawesome.withgoogle.com/interland/).
- The four-step routine is adapted from Common Sense Education's lateral reading lesson.
- Fonts: Lilita One, Merriweather, Special Elite, Chakra Petch, and Staatliches, used under their open licenses (license files are in the `fonts/` folder).

# AI Detective: Product Steering

Tagline: AI as a tool, not the answer.

## What we are building
AI Detective is a free, browser-based game for grades 6-8 (ages 11-14). Kids read an AI chatbot's answer, hunt for a planted mistake, and learn a short routine for checking AI answers. A teacher page shows anonymous, class-wide results.

The one thing this app teaches: AI can sound confident and still be wrong, so check it.

## Audience and tone
- Write at about a 6th-grade reading level. Keep sentences short and words plain.
- Friendly, curious, a little funny. Never babyish. Feel a bit older than Google's Interland.
- Wrong answers are part of detective work. Never shame or scold. The feedback line says why in one sentence, then offers a retry.
- Do not make AI the villain. The message is "use AI wisely," not "AI is bad." The Confident Bot is funny, not evil: overconfident, never malicious.
- Keep humor in the Confident Bot's personality (for example, "I am 1,000% sure, trust me"). Keep detective instructions and feedback clear and plain. Avoid heavy slang and meme language, which dates fast and can make the game feel less serious.
- Minimal text on screen. Explanations are 30-60 seconds at most, then the kid does something.

## Privacy rules (non-negotiable)
- No accounts, no sign-in, no logins.
- Never collect names, emails, addresses, phone numbers, photos, or any personal info from kids.
- No free-text input boxes for kids. Use buttons, multiple choice, and tapping or highlighting only.
- No third-party analytics, ad, or tracking scripts.
- Anything stored must be anonymous aggregate counts only (for example, how many kids missed each mistake type). No user IDs or anything that identifies a student.
- Progress that stays on the kid's device (browser only) is fine. Nothing personal leaves the device.
- Certificate has a blank line for the kid to write their own name. The app never stores a name.

## The core game
- Each case shows a short, pre-written AI chatbot answer with exactly one planted mistake. Cases are drafted in a batch by Kiro (about 12-15 for the MVP), then reviewed and fixed by a human before they go in the repo. They are stored in the repo, not generated live. Each case includes: the question the kid sees, the AI answer, the planted mistake and its type, a one-line "why," and how to check it with SPOT.
- Planted mistake types: invented authority ("Stanford scientists say..."), extreme numbers, no specifics, and overconfident tone.
- Every mistake is labeled with its type and has a one-sentence "why" shown after the kid answers.
- The "check the AI" routine is called SPOT: Step away, Pick your search words, Open other sources, Test and decide. It is adapted from lateral reading (credit Common Sense Education). Do not reuse Common Sense's SEEK.
- Theme: a junior detective agency. The kid is a junior detective hopping across stepping stones in a foggy river toward the agency's HQ island. Each stone is a case. Finished cases earn "Case Closed" stamps and badges, and ranks run Rookie to Chief.
- The "Confident Bot" is the AI character in every case. It wears a mask of confidence. Finding the planted mistake unmasks it and reveals the made-up fact, in the style of a classic mystery cartoon unmasking.
- SPOT is the detective's toolkit, shown as four tools the kid can use on any case.
- Wrong answer: a quick, funny fail moment, a one-line why, and a retry. A "Need a clue?" button nudges toward the routine without giving the answer away.
- Topics: low-stakes and kid-friendly (animals, space, sports rules, food, school subjects). No politics, violence, health advice, or real private individuals.

## Facts and sources
- Any real fact, statistic, or claim used in a case, a dashboard, or the writeup must be cited with source name, link, and date accessed.
- Keep a source log in the repo (for example, `docs/source-log.md`) and update it whenever a fact is added.
- Paraphrase sources in our own words. Do not copy text or images from other sites.
- Credit Common Sense Education for ideas adapted from their lessons, and Google for the game-format inspiration (Interland).
- If a source is a company's own page, label it as a company source.

## Accessibility and classroom use
- Works on school Chromebooks and in a normal browser, with no install and no sign-in.
- Works on phones and computers.
- Large readable text and high color contrast (WCAG AA). Never use color alone to show right or wrong.
- Full keyboard play. Screen reader labels on all controls.
- Untimed by default. Any timer is an optional bonus round with a warning first.
- Sound is on by default so the game feels alive from the start. Browsers block audio until the first click or tap, so show a start screen with a Play button and begin music right after it. A clear mute control is always visible, and a pause menu offers mute, resume, restart, and home.
- A visible skip button on any intro or animation. Respect the reduced-motion setting.

## Teacher page
- Shows anonymous, class-wide results: which mistake types kids miss most, and which step of the routine helped most.
- No student names, no individual results.
- Written in plain language so a teacher can use it without training.

## End screen
- Shows score, named badges (each with a one-line skill), and buttons for Replay, Next case pack, and Download certificate.
- Printable certificate with a blank name line.

## Out of scope for the MVP
Do not build these now. They are listed as future work in the writeup: a Rookie-to-Chief level system, a preview-as-student mode, an "ask it neutrally" round, a "find the claim" highlight step, a matching round, a case notebook, a "why AI gets things wrong" explainer, a "what is this leaving out" prompt, an end-of-round reflection, a personal-info round, themed case packs, a 10-question round, a practice-then-final-case structure, and per-mistake-type progress badges.

## Hackathon requirements
- Built entirely with Kiro. Keep screenshots of Specs, Steering, and Hooks.
- Public GitHub repo, deployed link, cited-source dashboard with source log, and teacher page.
- Writeup, 2-3 minute demo video, and blog post.

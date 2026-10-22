# Requirements Document

## Introduction

AI Detective is a free, browser-based educational game for grades 6-8 (ages 11-14). A kid reads a short answer written by a cartoon character called the Confident Bot, hunts for one planted mistake, and learns a four-step routine (SPOT) for checking AI answers. The game runs as a plain static website (HTML, CSS, JavaScript) with no build step and no backend, reusing the existing `index.html`, `styles.css`, and `script.js` setup and the existing deployment model.

A single run is 10 cases shown as stepping stones across a foggy river toward the detective agency HQ island. The game collects no personal information, has no accounts, and offers no free-text input for kids. A teacher page shows anonymous, class-wide totals. A source dashboard displays cited sources kept in a repo source log.

This document defines the MVP requirements only. Items listed as out of scope in the product steering document are excluded.

## Glossary

- **Game**: The AI Detective browser application as a whole, served as a static website.
- **Case**: One puzzle. Includes the kid's question, the Confident Bot's answer, 3-4 selectable candidate phrases, exactly one planted mistake, the mistake type, a one-line "why," and SPOT tip content.
- **Run**: A single play session of exactly 10 cases, presented as stepping stones toward the HQ island.
- **Confident_Bot**: The in-game AI character that produces each case answer with an overconfident tone.
- **Mistake_Type**: The category of a planted mistake. One of: invented authority, extreme numbers, no specifics, overconfident tone.
- **Candidate_Phrase**: One of the 3-4 selectable phrases in a case answer that the kid chooses from. Exactly one is the planted mistake; the remaining 2-3 are Decoy_Phrases.
- **Decoy_Phrase**: A Candidate_Phrase that is a true, accurate statement taken from the Confident_Bot's answer, offered as a wrong choice. Each Case has 2-3 Decoy_Phrases.
- **SPOT_Toolkit**: The four-tool detective routine available on every case: Step away, Pick your search words, Open other sources, Test and decide.
- **SPOT_Tool**: One of the four tools in the SPOT_Toolkit. Each shows a short tip and a neutral search phrase for the current case.
- **Clue_Button**: The "Need a clue?" control that reveals the mistake type of the current case for a point cost, without revealing which Candidate_Phrase is correct.
- **Score**: The point total for the current run.
- **Question_Counter**: The on-screen indicator showing the current case number out of the total in the run.
- **Start_Screen**: The first screen, containing a Play button, shown before any audio plays.
- **Pause_Menu**: The in-game menu offering mute, resume, restart, and home.
- **End_Screen**: The screen shown after the final case, showing Score, badges, and Replay, Next case pack, and Download certificate buttons.
- **Badge**: An end-screen award, one per Mistake_Type, each labeled with a one-line skill.
- **Certificate**: A printable end-screen document with a blank line for the kid to write a name. The Game never stores the name.
- **Teacher_Page**: A page showing anonymous, class-wide aggregate totals only.
- **Aggregate_Store**: The storage holding anonymous aggregate counts. The baseline is browser `localStorage` on the kid's device.
- **Source_Dashboard**: A page that displays cited sources read from the repo source log.
- **Source_Log**: The repo file `docs/source-log.md` listing each cited source's name, link, and date accessed.
- **Cases_Data**: The repo file `data/cases.json` holding the pre-written cases for a run.
- **Reduced_Motion_Setting**: The operating system or browser "prefers reduced motion" preference.

## Requirements

### Requirement 1: Static-site structure and data loading

**User Story:** As a developer, I want the Game to run as a static site that loads cases from a data file, so that no build step or backend is needed and deployment stays unchanged.

#### Acceptance Criteria

1. THE Game SHALL run using only static HTML, CSS, and JavaScript files served by the existing static-site deployment.
2. THE Game SHALL operate without a build step and without a backend server.
3. WHEN a Run starts, THE Game SHALL load Cases_Data from `data/cases.json` within 10 seconds.
4. WHEN Cases_Data is loaded and contains 10 or more valid Cases, THE Game SHALL select exactly 10 Cases for the Run.
5. IF Cases_Data is loaded and contains fewer than 10 valid Cases, THEN THE Game SHALL select all available valid Cases (minimum 1) for the Run.
6. IF Cases_Data contains 0 valid Cases after validation, THEN THE Game SHALL display an error message indicating that no Cases are available and a retry control, without starting the Run.
7. IF Cases_Data fails to load within 10 seconds or returns a parsing error, THEN THE Game SHALL display an error message indicating the load failure and a retry control, and SHALL preserve any previously loaded Cases_Data.
8. IF a Case in Cases_Data is missing one or more required fields (the question shown to the kid, the AI answer, the planted mistake, the planted mistake type, the one-line why, and the SPOT check), THEN THE Game SHALL exclude that Case from selection and continue selecting from the remaining valid Cases.

### Requirement 2: Case play and stepping-stone progression

**User Story:** As a kid, I want to read the Confident Bot's answer and pick the planted mistake by tapping a phrase, so that I can practice spotting AI mistakes without typing.

#### Acceptance Criteria

1. WHEN a Case is shown, THE Game SHALL display the kid's question and the Confident_Bot's answer.
2. WHEN a Case is shown, THE Game SHALL display between 3 and 4 Candidate_Phrases drawn from the Confident_Bot's answer, of which exactly 1 corresponds to the planted mistake.
3. THE Game SHALL present each Case as a stepping stone in a foggy river leading toward the HQ island.
4. THE Game SHALL accept Candidate_Phrase selection through tapping, clicking, or keyboard activation only.
5. THE Game SHALL provide no free-text input control for the kid.
6. WHILE a Run is in progress, THE Game SHALL display the Question_Counter showing the current case number as a value from 1 to 10 alongside the total of 10.
7. WHILE a Run is in progress, THE Game SHALL display the current Score as a non-negative integer.
8. WHEN the kid selects the Candidate_Phrase corresponding to the planted mistake, THE Game SHALL mark the Case as solved and visually indicate the selected phrase as correct using both a non-color cue and color.
9. IF the kid selects a Candidate_Phrase that does not correspond to the planted mistake, THEN THE Game SHALL indicate the selection is incorrect using both a non-color cue and color, retain the current Case without advancing, and allow the kid to select again.
10. WHILE a Run is in progress, THE Game SHALL keep every control reachable and operable by keyboard and expose a screen-reader label on each Candidate_Phrase control.

### Requirement 3: Answer feedback

**User Story:** As a kid, I want clear feedback when I pick a phrase, so that I learn from a wrong answer and feel rewarded for a right one.

#### Acceptance Criteria

1. WHEN the kid selects the Candidate_Phrase that is the planted mistake, THE Game SHALL unmask the Confident_Bot and reveal the Mistake_Type for that Case.
2. WHEN the kid selects the Candidate_Phrase that is the planted mistake, THE Game SHALL display the one-sentence "why" explanation for that Case's Mistake_Type.
3. WHEN the kid selects the planted mistake, THE Game SHALL add between 1 and 100 points to the Score, where the awarded points decrease by a fixed amount for each prior wrong attempt on the same Case down to a minimum of 1 point.
4. WHEN the kid selects the planted mistake, THE Game SHALL advance the detective to the next stepping stone within 3 seconds of the unmask reveal completing.
5. IF the kid selects a Candidate_Phrase that is not the planted mistake, THEN THE Game SHALL display a fail indication lasting between 1 and 3 seconds, a one-line reason text of at most 120 characters, and a visible retry control that re-enables selection for the same Case.
6. IF the kid selects a Candidate_Phrase that is not the planted mistake, THEN THE Game SHALL retain the current Case and its Candidate_Phrases without advancing the detective.
7. WHEN a one-line reason is shown, THE Game SHALL state the reason using neutral, non-shaming language that contains no second-person blame words and no negative judgment words directed at the kid.
8. THE Game SHALL indicate a right outcome and a wrong outcome using a distinct text label and a distinct shape or icon cue for each, in addition to color, such that the two outcomes are distinguishable without relying on color.

### Requirement 4: SPOT toolkit

**User Story:** As a kid, I want four detective tools on every case, so that I can learn a repeatable routine for checking AI answers.

#### Acceptance Criteria

1. WHILE a Case is shown, THE Game SHALL make all four SPOT_Tools (Step away, Pick your search words, Open other sources, Test and decide) available as keyboard-operable controls with visible text labels and screen reader labels.
2. WHEN the kid activates a SPOT_Tool, THE Game SHALL display a tip of 1 to 2 sentences (maximum 160 characters) for that tool and a neutral search phrase for the current Case.
3. WHEN the kid activates a SPOT_Tool, THE Game SHALL keep the current Case active and SHALL NOT submit an answer or advance to another Case.
4. WHEN the kid activates a SPOT_Tool, THE Game SHALL increment an anonymous aggregate count for that tool type, storing no student name, identifier, or free-text input.
5. IF the content for the activated SPOT_Tool cannot be displayed, THEN THE Game SHALL keep the current Case active, SHALL show a message indicating the tip is unavailable, and SHALL NOT submit or advance the Case.
6. WHILE a Case is shown, THE Game SHALL allow each SPOT_Tool to be activated an unlimited number of times without ending or resetting the current Case.

### Requirement 5: Need a clue

**User Story:** As a kid, I want an optional clue when I am stuck, so that I get a nudge toward the mistake type without being handed the answer.

#### Acceptance Criteria

1. WHILE a Case is shown and has not yet been answered, THE Game SHALL display the Clue_Button as an enabled, visible control.
2. WHEN the kid activates the Clue_Button for the current Case, THE Game SHALL reveal only the Mistake_Type label for that Case and SHALL keep the exact Candidate_Phrase that is the planted mistake concealed.
3. WHEN the kid activates the Clue_Button for the first time on the current Case, THE Game SHALL subtract 5 points from the Score.
4. IF the kid activates the Clue_Button again on a Case for which a clue has already been revealed, THEN THE Game SHALL re-display the Mistake_Type label and SHALL NOT subtract any additional points from the Score.
5. IF subtracting the clue cost would reduce the Score below 0, THEN THE Game SHALL set the Score to exactly 0 and SHALL NOT display a negative Score.

### Requirement 6: Start screen, audio, and pause

**User Story:** As a kid, I want a start screen and in-game controls, so that music begins when I choose and I can pause, mute, or restart at any time.

#### Acceptance Criteria

1. THE Game SHALL display the Start_Screen with a Play button before any audio plays.
2. WHEN the kid activates the Play button, THE Game SHALL start background music within 1 second.
3. THE Game SHALL start no audio before the first click or tap on the Start_Screen.
4. WHILE the Game is running, THE Game SHALL display a mute control that is keyboard-focusable and has a screen reader label.
5. WHILE the Game is running, THE Game SHALL provide a keyboard-accessible control that opens the Pause_Menu.
6. WHEN the Pause_Menu is open, THE Game SHALL halt gameplay progression and offer mute, resume, restart, and home controls.
7. WHEN the kid activates resume from the Pause_Menu, THE Game SHALL close the Pause_Menu and restore the Case and Score exactly as they were before pausing.
8. WHEN the kid activates restart from the Pause_Menu, THE Game SHALL request confirmation before discarding the current Run, and SHALL start a new Run only after confirmation.
9. WHEN the kid activates home from the Pause_Menu, THE Game SHALL return to the Start_Screen.
10. WHEN the kid activates the mute control, THE Game SHALL silence all Game audio, and WHEN the kid activates unmute, THE Game SHALL restore audio to its prior state.

### Requirement 7: Intros, animations, and skip

**User Story:** As a kid, I want to skip animations and play fully by keyboard, so that the Game works for me regardless of how I interact.

#### Acceptance Criteria

1. WHILE an intro or animation plays, THE Game SHALL display a skip control that is keyboard-focusable and has a screen-reader label.
2. WHEN the kid activates the skip control, THE Game SHALL stop the current intro or animation within 200 milliseconds and display the next screen or Case.
3. WHERE the Reduced_Motion_Setting is enabled, THE Game SHALL remove all non-essential motion and present the end state of each intro or animation without transition effects.
4. THE Game SHALL support completing a full Run using keyboard input alone, with every interactive control reachable by keyboard.
5. WHILE any interactive control has keyboard focus, THE Game SHALL display a visible focus indicator that meets WCAG AA contrast against its background.
6. WHEN the kid moves focus using keyboard navigation, THE Game SHALL advance focus in reading order across interactive controls.

### Requirement 8: End screen and certificate

**User Story:** As a kid, I want an end screen with my score, badges, and a printable certificate, so that I can celebrate finishing and show what I learned.

#### Acceptance Criteria

1. WHEN the final Case of a Run is completed, THE Game SHALL display the End_Screen within 1 second.
2. WHEN the End_Screen is shown, THE Game SHALL display the final Score.
3. WHEN the End_Screen is shown, THE Game SHALL display one Badge for each Mistake_Type the kid identified correctly at least once during the Run, each Badge labeled with a one-line skill description of 60 characters or fewer.
4. WHEN the End_Screen is shown, THE Game SHALL display exactly three controls: Replay, Next case pack, and Download certificate, each keyboard-focusable and each with a screen reader label.
5. WHEN the kid activates Replay, THE Game SHALL start a new Run using the same case pack just completed.
6. WHEN the kid activates Next case pack, THE Game SHALL start a new Run containing only Cases not played in the just-completed Run.
7. IF no unplayed Cases remain when the kid activates Next case pack, THEN THE Game SHALL start a new Run beginning again from the first available case pack.
8. WHEN the kid activates Download certificate, THE Game SHALL produce a printable Certificate that contains a visible blank line for a handwritten name and no pre-filled name.
9. THE Game SHALL store no name and no other personal information from the Certificate on the device or anywhere else.

### Requirement 9: Privacy

**User Story:** As a parent or teacher, I want the Game to collect no personal information, so that kids can play safely with nothing personal leaving the device.

#### Acceptance Criteria

1. THE Game SHALL operate without any account creation, sign-in, or login mechanism, and SHALL present no screen or control that prompts for account credentials.
2. THE Game SHALL provide no free-text input field capable of capturing names, emails, addresses, phone numbers, or photos, and SHALL accept kid input only through buttons, multiple-choice selections, tapping, and highlighting.
3. THE Game SHALL collect no names, emails, addresses, phone numbers, photos, or other personal information identifying a kid.
4. THE Game SHALL load no third-party analytics, advertising, or tracking scripts, such that zero network requests are made to third-party analytics, advertising, or tracking domains during play.
5. WHERE the Game stores data off the device, THE Game SHALL store anonymous aggregate counts only, with no user identifier, no device identifier, and no field that can identify an individual kid.
6. THE Game SHALL confine all on-device progress data to the kid's browser storage on that device, and SHALL transmit no personal data off the device.

### Requirement 10: Teacher page and anonymous aggregate storage

**User Story:** As a teacher, I want anonymous class-wide totals, so that I can see which mistake types kids miss most and which SPOT tool is used most without seeing any individual.

#### Acceptance Criteria

1. THE Teacher_Page SHALL display totals of how many answers missed each Mistake_Type.
2. THE Teacher_Page SHALL display totals of how often each SPOT_Tool is used.
3. THE Teacher_Page SHALL display no student names and no individual results.
4. THE Teacher_Page SHALL present totals in plain language readable without training.
5. THE Game SHALL use browser `localStorage` as the baseline Aggregate_Store, holding anonymous aggregate counts on the kid's device, requiring no new service.
6. THE Teacher_Page SHALL indicate that, with the baseline Aggregate_Store, totals reflect only plays on that one device and browser.
7. WHEN the Aggregate_Store contains no recorded plays, THE Teacher_Page SHALL display an empty-state message rather than blank or zeroed-out sections.
8. WHERE cross-device or class-wide aggregation beyond a single device is desired, THE Game SHALL treat the aggregation backend as a separate decision requiring user approval before any such service is added.
9. THE Game SHALL assume no backend service exists unless the user approves one.

### Requirement 11: Source dashboard and source log

**User Story:** As a teacher or reviewer, I want cited sources shown on a dashboard and tracked in the repo, so that every real fact used in a case can be checked.

#### Acceptance Criteria

1. THE Source_Dashboard SHALL display each cited source's name, link, and date accessed, read from the Source_Log at `docs/source-log.md`.
2. THE Source_Log SHALL be kept in the repo.
3. WHERE a real fact or statistic is used in a Case, THE Source_Log SHALL contain a citation for that fact with source name, link, and date accessed.
4. IF the Source_Log cannot be read, THEN THE Source_Dashboard SHALL display a message that sources are unavailable.
5. IF the Source_Log contains no entries, THEN THE Source_Dashboard SHALL display an empty-state message indicating no sources are listed yet.

### Requirement 12: Content tone and reading level

**User Story:** As a kid, I want friendly, plain language, so that the Game is easy to read and never makes me feel bad for guessing wrong.

#### Acceptance Criteria

1. THE Game SHALL present detective instructions and feedback text with a Flesch-Kincaid grade level of 8.0 or lower.
2. THE Game SHALL present detective instructions and feedback text using sentences of 15 words or fewer.
3. THE Game SHALL present the Confident_Bot with an overconfident personality using at least one confident-tone phrase per case answer and zero insulting, threatening, or demeaning statements toward the kid.
4. WHEN the Game displays an explanation screen, THE Game SHALL limit the screen to 120 words or fewer before presenting an action control.
5. WHEN the kid selects a wrong answer, THE Game SHALL present feedback that contains zero shaming or scolding language and SHALL present a retry control.

### Requirement 13: Accessibility

**User Story:** As a kid using assistive technology or a school Chromebook, I want the Game to be accessible, so that I can play fully regardless of ability or device.

#### Acceptance Criteria

1. THE Game SHALL render all body text and interactive control labels at a contrast ratio of at least 4.5:1 against their background, and all large text and non-text interactive control boundaries at a contrast ratio of at least 3:1.
2. WHEN the Game indicates a right answer, a wrong answer, or any control state (selected, focused, disabled, or active), THE Game SHALL convey that indication using at least one non-color cue in addition to any color cue.
3. THE Game SHALL provide a programmatically associated text label, readable by screen readers, on every interactive control.
4. WHEN the Game presents a Case, THE Game SHALL impose no time limit on the kid's response by default, and THE Game SHALL only apply a time limit within an explicitly opt-in bonus round that shows a warning before starting.
5. THE Game SHALL support full operation using keyboard-only input, such that every interactive control can be reached and activated without a pointing device.
6. THE Game SHALL load and run in a standard web browser, including the browser on school Chromebooks, requiring no software installation and no sign-in or account creation.
7. WHERE the device operating system or browser signals a reduced-motion preference, THE Game SHALL disable or replace non-essential motion animations with a static or reduced-motion equivalent.
8. THE Game SHALL present a usable, fully operable layout on viewport widths from 320 pixels up to at least 1920 pixels, with no loss of content or function and no horizontal scrolling required to reach any control.

VOIDER PLAYZ — WORD & NUMBER GUESSER
===================================

GitHub Pages deployment:
1. Open the repository voiderplayzyt/voiderplayzyt.github.io.
2. Create a folder named Word-Number-Guesser at the repository root.
3. Add Word-Number-Guesser/index.html to the folder.
4. To add the hub menu card, replace your root index.html with the
   supplied 'Hub-index-with-guesser.html' (rename it to index.html),
   OR copy the new card from that HTML into your existing hub grid.
5. Commit to branch main. Your game will be available at:
   https://voiderplayzyt.github.io/Word-Number-Guesser/

Features:
- Offline-ready single-file HTML (no libraries, database or backend).
- 3–11 letter words from Animals/Food/Objects/Mixed/Custom lists.
- Custom TXT uploads or pasted word lists.
- 1–6 digit number mode, with custom minimum and maximum.
- Generate a secret and score your friend's guesses.
- Automatic suggestions based on candidate partition patterns.
- In-order clues (G/Y/R) AND counts-only clues (1 green, 2 yellow).
- Mix clue types within one round; undo clues.
- Repeated letters/digits handled using standard Wordle scoring.

Notes:
- The solver only considers words from its built-in or custom list.
- In number mode, fixed-width guesses may include leading zeroes.
- Don't enter a feedback pattern for a different guess.
- If a clue produces zero possibilities, it won't be saved.
- No files are uploaded to a server; everything runs in the browser.

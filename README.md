## The Floor – Local Host Console

This project powers a lean, local-only control room for running head-to-head rounds of the party game **The Floor**. A host can queue contestants, pick a question deck that has been exported as a PDF, and run the round from a single screen using keyboard shortcuts.

### Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Preparing question decks

1. Build your question slides in Google Slides, Keynote, PowerPoint, etc.
2. Export each deck as a PDF.
3. Drop the file into `public/topics`. Example: `public/topics/90s-pop.pdf`.
4. Refresh the setup page – the deck will appear in the topic dropdown automatically.

Each PDF page renders as a standalone question card on the round screen.

### Running a round

1. On the home page, type in both contestants’ names and pick a topic deck.
2. Hit **Start Round** – you’ll be taken to the live round screen.
3. Control the flow with buttons or hotkeys:
   - `J`: mark correct and advance to the next question (passes the clock)
   - `P`: pass (−3 seconds, same player continues after a short pause)
   - `S`: switch (current question goes to the opponent; 3 per player)
4. The round ends automatically when a player’s clock hits zero.

Use any screen-sharing tool to project the `/round` view to a TV while you run the controls.

### Project structure

- `src/state/roundStore.ts` – shared game state (timers, deck progress, actions) powered by Zustand.
- `src/components/SetupRoundForm.tsx` – pre-round lobby for names + deck selection.
- `src/components/RoundScreen.tsx` – live control UI with timers, actions, and deck display.
- `src/components/PdfSlideViewer.tsx` – thin wrapper around `pdfjs-dist` to render PDF slides.

Everything is intentionally in-memory: refreshing the page resets the round. Add persistence or additional actions later if you decide to harden it for production.

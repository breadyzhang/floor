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
2. Hit **Start Round** – you’ll land on the host control screen.
3. (Optional) click **Launch stage display** to open `/stage` in a new window. Share only that window (or monitor) to the TV so contestants see the clocks and slide without the host controls.
4. Control the flow with buttons or hotkeys:
   - `J`: mark correct and advance to the next question (passes the clock)
   - `P`: pass (−3 seconds, same player continues after a short pause)
   - `S`: switch (current question goes to the opponent; 3 per player)
5. The round ends automatically when a player’s clock hits zero. The stage view mirrors every update instantly via `BroadcastChannel`.

### Project structure

- `src/state/roundStore.ts` – shared game state (timers, deck progress, actions) powered by Zustand.
- `src/components/SetupRoundForm.tsx` – pre-round lobby for names + deck selection.
- `src/components/RoundScreen.tsx` – host control UI with timers, actions, answer key, and stage-launch shortcut.
- `src/components/StageScreen.tsx` – audience-facing view that receives live updates over `BroadcastChannel`.
- `src/components/PdfSlideViewer.tsx` – thin wrapper around `pdfjs-dist` to render PDF slides.

Everything is intentionally in-memory: refreshing the page resets the round. Add persistence or additional actions later if you decide to harden it for production.

### Answer keys (optional)

Provide host-only answers by dropping a JSON file next to the PDF with the same base name. Example:

```
public/topics/math.pdf
public/topics/math.json
```

`math.json` can be either an array of strings or an object with an `answers` array:

```json
{
  "answers": [
    "24",
    "Pythagorean theorem",
    "Euler"
  ]
}
```

The host screen shows the entry aligned with the current question, while the stage display never renders or receives the answer text.

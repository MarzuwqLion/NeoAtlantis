/**
 * Entry point. ?viewer opens the standalone animation viewer; otherwise the game.
 */
import './ui/styles.css';

const params = new URLSearchParams(location.search);

async function boot(): Promise<void> {
  if (params.has('viewer')) {
    const { startViewer } = await import('./app/viewerMain');
    startViewer();
  } else {
    const { startGame } = await import('./app/gameMain');
    startGame();
  }
}

void boot();

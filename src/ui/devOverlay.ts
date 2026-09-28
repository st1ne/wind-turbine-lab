/**
 * Dev-only stats overlay (TODO.md Phases 2 and 6), toggled with the backtick key:
 * fps, frame time, draw calls, triangles, sim clock (time scale, pause) and the live SimSnapshot.
 */
import type { WebGLRenderer } from 'three';
import type { SimSnapshot } from '@/physics/types';
import type { UiState } from '@/state/uiState';

export interface DevOverlay {
  frame(dt: number, renderer: WebGLRenderer, snapshot: SimSnapshot, ui: Readonly<UiState>): void;
}

export function createDevOverlay(root: HTMLElement): DevOverlay {
  const el = document.createElement('pre');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    margin: '0',
    padding: '8px 10px',
    font: '11px/1.35 "JetBrains Mono", ui-monospace, monospace',
    color: '#9fe8ff',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: '99',
    display: 'none',
    whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>);
  root.appendChild(el);
  let visible = false;
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      visible = !visible;
      el.style.display = visible ? 'block' : 'none';
    }
  });

  let acc = 0;
  let frames = 0;
  let fps = 0;
  let ms = 0;
  return {
    frame(dt, renderer, s, ui) {
      acc += dt;
      frames++;
      if (acc < 0.5) return;
      fps = frames / acc;
      ms = (acc / frames) * 1000;
      acc = 0;
      frames = 0;
      if (!visible) return;
      const info = renderer.info.render;
      const snap = Object.fromEntries(
        Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]),
      );
      el.textContent =
        `${fps.toFixed(0)} fps  ${ms.toFixed(1)} ms  dpr ${renderer.getPixelRatio()}\n` +
        `draw calls ${info.calls}  triangles ${info.triangles.toLocaleString('en-US')}\n` +
        `sim ×${ui.timeScale}${ui.paused ? ' PAUSED' : ''}  follow ${ui.follow}  view ${ui.view}  ${ui.rotorMode}${ui.pitchLock ? ' LOCK' : ''}\n` +
        JSON.stringify(snap, null, 1)
          .replace(/[{}"]/g, '')
          .replace(/\n\s*\n/g, '\n');
    },
  };
}

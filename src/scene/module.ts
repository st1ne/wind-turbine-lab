/**
 * Common contract for scene modules (TECH_SPEC §18):
 * every create…() returns { object3d, update(snapshot, ui, dt), dispose() }.
 */
import type { Object3D } from 'three';
import type { SimSnapshot } from '@/physics/types';
import type { UiState } from '@/state/uiState';

export interface SceneModule<T extends Object3D = Object3D> {
  readonly object3d: T;
  update(snapshot: SimSnapshot, ui: UiState, dt: number): void;
  dispose(): void;
}

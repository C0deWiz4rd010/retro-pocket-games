import { describe, expect, it } from 'vitest';
import { RNG } from '@utils/rng';
import { EMPTY, idx } from '@kits/grid/core';
import { createColumns, hardDrop, resolveMatches, spawnPiece } from './core';

describe('columns core', () => {
  it('hard-drops and locks a vertical triple', () => {
    const state = createColumns(new RNG(1));
    state.piece = { col: 2, row: 0, cells: [1, 2, 3] };
    expect(hardDrop(state)).toBe(11);
    expect(state.board[idx(state.cols, 2, 11)]).toBe(1);
    expect(state.board[idx(state.cols, 2, 12)]).toBe(2);
    expect(state.board[idx(state.cols, 2, 13)]).toBe(3);
  });

  it('clears horizontal, vertical, and diagonal runs once', () => {
    const state = createColumns(new RNG(2));
    state.board.fill(EMPTY);
    state.board[idx(state.cols, 0, 13)] = 4;
    state.board[idx(state.cols, 1, 13)] = 4;
    state.board[idx(state.cols, 2, 13)] = 4;
    state.board[idx(state.cols, 4, 11)] = 2;
    state.board[idx(state.cols, 4, 12)] = 2;
    state.board[idx(state.cols, 4, 13)] = 2;
    state.board[idx(state.cols, 0, 10)] = 1;
    state.board[idx(state.cols, 1, 11)] = 1;
    state.board[idx(state.cols, 2, 12)] = 1;

    const result = resolveMatches(state);

    expect(result.cleared).toBe(9);
    expect(state.score).toBe(180);
    expect(state.board.filter((v) => v !== EMPTY)).toHaveLength(0);
  });

  it('collapses jewels and applies combo scoring across cascades', () => {
    const state = createColumns(new RNG(3));
    state.board.fill(EMPTY);
    state.board[idx(state.cols, 0, 13)] = 1;
    state.board[idx(state.cols, 1, 13)] = 1;
    state.board[idx(state.cols, 2, 13)] = 1;
    state.board[idx(state.cols, 0, 10)] = 5;
    state.board[idx(state.cols, 1, 9)] = 5;
    state.board[idx(state.cols, 2, 11)] = 5;

    const first = resolveMatches(state);
    const second = resolveMatches(state);

    expect(first.cleared).toBe(3);
    expect(second.cleared).toBe(3);
    expect(second.combo).toBe(2);
    expect(state.score).toBe(180);
  });

  it('marks game over when spawning into a blocked column', () => {
    const state = createColumns(new RNG(4));
    state.board[idx(state.cols, state.piece.col, 0)] = 1;
    spawnPiece(state, new RNG(5));
    expect(state.over).toBe(true);
  });
});

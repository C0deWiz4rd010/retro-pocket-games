/** Runs `fn` at most once — for game-over/finish paths that several code branches can reach. */
export function once<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let done = false;
  return (...args: A) => {
    if (done) return;
    done = true;
    fn(...args);
  };
}

/** Tiny DOM helpers so the framework-free UI stays readable. */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/** Clear all children of a node. */
export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Mount content into #app (replacing previous view). */
export function mount(view: Node): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app root not found');
  root.replaceChildren(view);
}

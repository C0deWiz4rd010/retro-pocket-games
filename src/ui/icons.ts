import {
  ChevronLeft,
  Download,
  Dices,
  Home,
  Info,
  Medal,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  Share2,
  SkipForward,
  Star,
  Trash2,
  Trophy,
  User,
  Volume2,
  VolumeX,
  type IconNode,
} from 'lucide';

const ICONS = {
  back: ChevronLeft,
  daily: Star,
  download: Download,
  home: Home,
  info: Info,
  leaderboard: Medal,
  menu: Menu,
  pause: Pause,
  play: Play,
  profile: User,
  restart: RotateCcw,
  search: Search,
  settings: Settings,
  share: Share2,
  skip: SkipForward,
  soundOff: VolumeX,
  soundOn: Volume2,
  surprise: Dices,
  trash: Trash2,
  trophy: Trophy,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, label?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'lucide-icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const [tag, attrs] of ICONS[name] as IconNode) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) child.setAttribute(key, String(value));
    }
    svg.append(child);
  }
  return svg;
}

export function iconText(name: IconName, text: string): (Node | string)[] {
  return [icon(name), document.createTextNode(text)];
}

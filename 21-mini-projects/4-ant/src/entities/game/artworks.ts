import type { ColorId, Pixel } from "./types";

const SWATCH: Record<string, ColorId> = {
  X: "ink",
  W: "white",
  C: "cream",
  O: "peach",
  R: "coral",
  Y: "gold",
  G: "mint",
  B: "blue",
  P: "violet",
  H: "brown",
};
type Artwork = { name: string; rows: string[] };
const art = (name: string, rows: string): Artwork => ({
  name,
  rows: rows
    .trim()
    .split("\n")
    .map((row) => row.trim()),
});

// Authored color maps: outlines, faces and ingredients have intentional colors.
// No color bands, random recoloring or difficulty-dependent resampling.
export const ARTWORKS: Artwork[] = [
  art(
    "귤냥이",
    `
..XX........XX..
.XOOX......XOOX.
.XOROXXXXXXOROX.
.XOOOOOOOOOOOOX.
XOOOOOOOOOOOOOOX
XOOOXOOOOOXOOOX
XOOOXOOOOOXOOOX
XORROOXXOOORROX
.XOOOOOOOOOOOX.
..XXXOCCOXXX...
....XOCCOX.....
....XOCCOX..XX.
...XOOCCOOXXOOX
...XOOCCOOOOOOX
...XOOXXOOXXXX.
....XX..XX.....`,
  ),
  art(
    "딸기 토끼",
    `
...XX....XX....
..XWWX..XWWX...
..XWRX..XRWX...
..XWRX..XRWX...
..XWWXXXXWWX...
.XWWWWWWWWWWX..
XWWWWWWWWWWWWX.
XWWWXWWWWXWWWX.
XWWWXWWWWXWWWX.
XWRRWWXXWWRRWX.
.XWWWWWWWWWWX..
..XXXWWWWXXX...
...XRRRRRRX....
..XWRRRRRRWX...
..XWWRRRRWWX...
...XXX..XXX....`,
  ),
  art(
    "꿀곰",
    `
..XXX......XXX..
.XHHHX....XHHHX.
XHOOHHXXXXHHOOHX
XHHHHHHHHHHHHHHX
.XHHHHHHHHHHHHX.
.XHHXHHHHXHHHHX.
.XHHXHHHHXHHHHX.
.XHHHCCCCCHHHHX.
.XHRRCXXCCRRHHX.
..XHHCCCCHHHHX..
...XXHHHHHXXX...
...XHYYYYYHX....
..XHHYYYYYHHX...
..XHHYWWYHHHX...
...XHYYYYYHX....
....XXX.XXX.....`,
  ),
  art(
    "꼬마 여우",
    `
.XXX........XXX.
.XOOX......XOOX.
.XOXOX....XOXOX.
.XOOOOXXXXOOOOX.
XOOOOOOOOOOOOOOX
XOOXOOOOOOXOOOOX
XOOXOOOOOOXOOOOX
XWWOOOOOOOOOWWWX
.XWWWWXXWWWWWWX.
..XWWWWWWWWWWX..
...XXWWWWWWXX...
....XOOOOOX..XX.
...XOOOWOOX.XWWX
...XOOWWWOXXWWWX
...XOOXXXOOOOXX.
....XX...XXXX...`,
  ),
  art(
    "펭귄 푸딩",
    `
.....XXXXXX.....
...XXBBBBBBXX...
..XBBBBBBBBBBX..
.XBBBWWWWWWBBBX.
.XBBWWWWWWWWBBX.
XBBBWWXWWXWWBBBX
XBBBWWXWWXWWBBBX
XBBBWWWYYWWWBBBX
.XBBWWYYYYWWBBX.
.XBBWWWWWWWWBBX.
XBBBWWWWWWWWBBBX
XBBBWWWWWWWWBBBX
XBBWWWWWWWWWWBBX
.XXBWWWWWWWWBXX.
...XXXXXXXXXX...
...XYYYXXYYYX...
....XXX..XXX....`,
  ),
  art(
    "달걀 병아리",
    `
.......XX.......
......XYYX......
....XXXYYXXX....
...XYYYYYYYYX...
..XYYYYYYYYYYX..
.XYYYXYYYYXYYYX.
.XYYYXYYYYXYYYX.
.XYRRYYYYYYRRYX.
.XYYYYYOOYYYYYX.
..XYYYYYYYYYYX..
.XXYWYWYWYWYXX..
XWWWXWXWXWXWWWX.
XWWWWWWWWWWWWWX.
.XWWWWWWWWWWWX..
..XWWWWWWWWWX...
...XXXXXXXXX....`,
  ),
  art(
    "연못 개구리",
    `
..XXXX....XXXX..
.XGGGGX..XGGGGX.
XGWWWWGXXGWWWWGX
XGWWXWGGGGWXWWGX
XGWWXWGGGGWXWWGX
.XGGGGGGGGGGGGX.
XGGGGGGGGGGGGGGX
XGRRGGGGGGGGRRGX
.XGGXXXXXXGGGGX.
..XGGGGGGGGGGX..
...XGCCCCCCGX...
..XGGCCCCCCGGX..
.XGGGCCCCCCGGGX.
.XGGXXCCCCXXGGX.
..XX..XXXX..XX..`,
  ),
  art(
    "대나무 판다",
    `
..XXX......XXX..
.XXXXX....XXXXX.
.XXWWXXXXXXWWXX.
.XWWWWWWWWWWWWX.
XWWXXXWWWWXXXWWX
XWWXWXWWWWXWXWWX
XWWXXXWWWWXXXWWX
XWWWWWWXXWWWWWWX
.XWWRRWWWWRRWWX.
..XXXWWWWWWXXX..
...XXWWWWWWXX...
..XXXWWWWWWXXX..
..XXXWWWWWWXXX..
...XXWWWWWWXX...
...XXXX..XXXX...`,
  ),
  art(
    "초코 강아지",
    `
...XXXXXXXXXX...
.XXHHCCCC CCHHXX.
XHHHHCCCCCCCCHHHX
XHHHHCCCCCCCCHHHX
XHHHCCXCCCXCCCHHX
XHHHCCXCCCXCCCHHX
.XHHCCCCCCCCCHHX.
..XCCRRCXCRRCCX..
..XCCCCRRCCCCX...
...XXXCCCCXXX....
....XHCCCCCHX....
...XHHCCCCCHHX...
...XHHCCCCCHHXX..
...XHHHCCCHHHHX..
....XXX...XXXX...`.replaceAll(" ", ""),
  ),
  art(
    "빨간 새",
    `
.........XXX....
.......XXRRX....
.....XXRRRRX....
....XRRRRRRRX...
...XRRWWWXRRX...
..XRRWWXWWRRRX..
XXYYRWWXWWRRRX..
XYYYYWWWWWRRRX..
.XXWWWWWWRRRRRX.
...XWWWWRRRRRRRX
...XWWWXXXXRRRRX
...XWWXWWWXRRRRX
....XWWXXXXRRRX.
.....XWWWWRRRX..
......XXXRRRRXX.
.....XYYXXXRRRX.
......XX...XXX..`,
  ),
  art(
    "알록달록 김밥",
    `
.....XXXXXX.....
...XXXXXXXXXX...
..XXXWWWWWWXXX..
.XXWWWWWWWWWWXX.
.XXWWWYYYWWWWXX.
XXWWYYGGGYYWWWXX
XXWWYGRRRGYWWWXX
XXWWYGRRRGYWWWXX
XXWWYYGGGYYWWWXX
XXWWWWYYYWWWWWXX
.XXWWWWWWWWWWXX.
.XXXWWWWWWWWXXX.
..XXXXXXXXXXXX..
...XHXXXXXXHX...
....XXXXXXXX....`,
  ),
  art(
    "주먹밥 친구",
    `
.......XX.......
......XWWX......
.....XWWWWX.....
....XWWWWWWX....
...XWWWWWWWWX...
..XWWWWWWWWWWX..
.XWWXWWWWWWXWWX.
.XWWXWWWWWWXWWX.
XWRRWWWWWWWWRRWX
XWWWWWWXXWWWWWWX
XWWWWXXXXXXWWWWX
XWWWWXXXXXXWWWWX
.XWWWXXXXXXWWWX.
..XXXXXXXXXXXX..`,
  ),
  art(
    "딸기 요정",
    `
......XGX.......
....XXGGGXX.....
..XXGGGGGGGXX...
...XGXGGGXGX....
..XRRRRRRRRRX...
.XRRYRRRRRYRRX..
XRRRRRRRRRRRRRX.
XRRXRRRRRRXRRRX.
XRRYRRYYRRYRRRX.
.XRRRRRRRRRRRX..
.XRRRYRRRYRRRX..
..XRRRRRRRRRX...
...XRRYRRYRX....
....XRRRRRX.....
.....XXXXX......`,
  ),
  art(
    "딸기 아이스크림",
    `
......XXXX......
....XXRRRRXX....
...XRRRRRRRRX...
..XRRWRRRRWRRX..
..XRRRRRRRRRRX..
..XRXXRRXXRRRX..
...XRRRRRRRRX...
..XCCCCCCCCCCX..
...XYYYYYYYYX...
...XYHYHYHYYX...
....XYYHYYYX....
....XHYHYHYX....
.....XYYYYX.....
.....XYHYHX.....
......XYYX......
.......XX.......`,
  ),
  art(
    "체리 컵케이크",
    `
.......XG.......
......XRRX......
......XRRX......
.....XXWWXX.....
....XWWWWWWX....
...XWWWWWWWWX...
..XWWWRWWRWWWX..
.XWWWWWWWWWWWWX.
.XXXXXXXXXXXXXX.
..XRRRRRRRRRRX..
..XRRXRRRRXRRX..
...XRXRRRRXRX...
...XRRRRRRRRX...
....XRRRRRRX....
.....XXXXXX.....`,
  ),
  art(
    "카라멜 푸딩",
    `
......XXXX......
.....XRRRRX.....
.....XRRRRX.....
....XXXXXXXX....
...XHHHHHHHHX...
...XHHHHHHHHX...
..XYYYYYYYYYYX..
..XYYXYYYYXYYX..
..XYYXYYYYXYYX..
.XYYYRYYYYRYYYX.
.XYYYYYYYYYYYYX.
.XYYYYXXXXYYYYX.
..XXXXXXXXXXXX..
.XXWWWWWWWWWWXX.
...XXXXXXXXXX...`,
  ),
  art(
    "구름 달걀",
    `
......XXXXX.....
...XXXWWWWWXX...
..XWWWWWWWWWWX..
.XWWWWWWWWWWWWX.
XWWWWWYYYYWWWWWX
XWWWWYYYYYYWWWWX
XWWWYYXYYXYYWWWX
XWWWYYYYYYYYWWWX
XWWWYYRYYRYYWWWX
.XWWWYYYYYYWWWX.
.XWWWWYYYYWWWWX.
..XWWWWWWWWWWX..
...XXWWWWWWXX...
.....XXXXXX.....`,
  ),
  art(
    "멜론빵",
    `
.....XXXXXX.....
...XXGGGGGGXX...
..XGGYGGYGGGGX..
.XGGGYGGYGGYGGX.
.XYYYYYYYYYYYYX.
XGGYGGYGGYGGYGGX
XGGYGGYGGYGGYGGX
XYYYYYYYYYYYYYYX
XGGGXGGGGGXGGGGX
XGGGXGGGGGXGGGGX
.XGGGGGYYGGGGGX.
..XGGGGGGGGGGX..
...XXXXXXXXXX...`,
  ),
  art(
    "연어 초밥",
    `
....XXXXXXXXX...
..XXRRRRRRRRRXX.
.XRRRWRRRWRRRRRX
XRRRWRRRWRRRRRRX
XRRWRRRWRRRWRRRX
.XRRRRRRRRRRRRX.
..XXXXXXXXXXXX..
..XWWWWWWWWWWX..
.XWWWXWWWWXWWWX.
.XWWWXWWWWXWWWX.
.XWWWWWRRWWWWWX.
..XWWWWWWWWWWX..
...XXXXXXXXXX...`,
  ),
  art(
    "찐만두",
    `
......XXXX......
.....XCCCCX.....
....XCHCHCCX....
...XCHCHCHCCX...
..XCHCHCHCHCCX..
.XCCCCCCCCCCCCX.
XCCCCCCCCCCCCCCX
XCCCXCCCCCCXCCCX
XCCCXCCCCCCXCCCX
XCCRRCCXXCCRRCCX
.XCCCCCCCCCCCCX.
..XCCCCCCCCCCX..
...XXXXXXXXXX...`,
  ),
];

const THEMES = ["", "꽃놀이", "하트", "별빛", "생일"];
const DECORATIONS = [
  [],
  [".R.", "RYR", ".G.", ".G."],
  ["RR.RR", "RRRRR", ".RRR.", "..R.."],
  ["..Y..", ".YYY.", "YYYYY", ".YYY.", "..Y.."],
  ["..P..", ".PYP.", "PPPPP", "XXXXX"],
];

export function stageArtwork(level: number): {
  name: string;
  pixels: Pixel[];
  width: number;
  height: number;
} {
  const base = ARTWORKS[(level - 1) % ARTWORKS.length];
  const theme = Math.floor((level - 1) / ARTWORKS.length);
  const cells = new Map<string, { x: number; y: number; color: ColorId }>();
  const paint = (rows: string[], ox: number, oy: number) =>
    rows.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        if (symbol === ".") return;
        if (!SWATCH[symbol])
          throw new Error(`Unknown artwork swatch: ${symbol}`);
        cells.set(`${x + ox},${y + oy}`, {
          x: x + ox,
          y: y + oy,
          color: SWATCH[symbol],
        });
      }),
    );
  paint(base.rows, 2, 5);
  if (theme)
    paint(DECORATIONS[theme], theme === 4 ? 8 : 19, theme === 4 ? 0 : 15);
  const pixels = [...cells.values()]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((cell, id): Pixel => ({ ...cell, id, status: "present" }));
  return {
    name: [THEMES[theme], base.name].filter(Boolean).join(" "),
    pixels,
    width: Math.max(...pixels.map((p) => p.x)) + 2,
    height: Math.max(...pixels.map((p) => p.y)) + 2,
  };
}

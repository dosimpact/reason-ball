const TC = `
3
4
7
10
`;

const readline = (() => {
  const stdin =
    process.platform === "linux"
      ? require("fs").readFileSync("dev/stdin").toString().split("\n")
      : TC.trim().split("\n");
  let line = 0;

  return () => stdin[line++];
})();

const N = Number(readline());
// d[i] 숫자 i를 1,2,3의 합으로 나타내는 방법의 수
// d[i] = d[i-1] + d[i-2] + d[i-3]
// ( i >= 4, d[1] = 1, d[2] = 2 (11, 2), d[3] = 4 (12, 111, 21,3)  )
const d = new Array(11).fill(0);
(d[1] = 1), (d[2] = 2), (d[3] = 4);

for (let i = 4; i < 11; i++) {
  d[i] = d[i - 1] + d[i - 2] + d[i - 3];
}

for (let i = 1; i <= N; i++) {
  const T = Number(readline());
  console.log(d[T]);
}

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


function go(current, goal) {
  if (current === goal) {
    return 1;
  }
  if (current > goal) {
    return 0;
  }
  let res = 0;
  for (let i = 1; i <= 3; i++) {
    res += go(current + i, goal)
  }
  return res;
}

const N = Number(readline());
for (let i = 0; i < N; i++) {
  const T = Number(readline());
  console.log(go(0, T));
}
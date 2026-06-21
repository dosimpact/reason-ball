const TC = `
1000 1 1000
999 1000
`;

const readline = (() => {
  const stdin =
    process.platform === "linux"
      ? require("fs").readFileSync("dev/stdin").toString().split("\n")
      : TC.trim().split("\n");
  let line = 0;

  return () => stdin[line++];
})();

// 정점수, 간선수, 탐색 시작 숫자.
const [N, M, V] = readline().split(" ").map(Number);
const graph = new Array(N + 1).fill(0).map(() => []);
let check = new Array(N + 1).fill(0);

for (let i = 1; i <= M; i++) {
  const [u, v] = readline().split(" ").map(Number);
  graph[u].push(v);
  graph[v].push(u);
}

for (let i = 1; i <= N; i++) {
  graph[i].sort((a, b) => a - b); // !!
}

// dfs
function dfs(currentNode) {
  for (let nextNode of graph[currentNode]) {
    if (!check[nextNode]) {
      check[nextNode] = 1;
      process.stdout.write(`${nextNode} `);
      dfs(nextNode);
    }
  }
}

check[V] = 1;
process.stdout.write(`${V} `);
dfs(V);

// clean up
check = new Array(N + 1).fill(0);
console.log();

// bfs
const queue = [V];
check[V] = 1;

while (queue.length >= 1) {
  const currentNode = queue.shift();
  process.stdout.write(`${currentNode} `);

  for (let nextNode of graph[currentNode]) {
    if (!check[nextNode]) {
      check[nextNode] = 1;
      queue.push(nextNode);
    }
  }
}

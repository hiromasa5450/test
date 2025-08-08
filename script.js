// === canvas & context ===
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
nextCtx.scale(20, 20);

const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');
holdCtx.scale(20, 20);

// === テトリミノの色 ===
const colors = [
  null,
  '#00f0f0', // I
  '#0000f0', // J
  '#f0a000', // L
  '#f0f000', // O
  '#00f000', // S
  '#a000f0', // T
  '#f00000', // Z
  'rgba(255,255,255,0.3)' // ゴースト
];

const arena = createMatrix(12, 20);
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let ghostPiece = null;
let holdPiece = null;
let holdUsed = false;

const player = {
  pos: {x: 0, y: 0},
  matrix: null,
  next: [],
  score: 0
};

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'T': return [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ];
    case 'O': return [
      [2, 2],
      [2, 2],
    ];
    case 'L': return [
      [0, 0, 3],
      [3, 3, 3],
      [0, 0, 0],
    ];
    case 'J': return [
      [4, 0, 0],
      [4, 4, 4],
      [0, 0, 0],
    ];
    case 'I': return [
      [0, 0, 0, 0],
      [5, 5, 5, 5],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    case 'S': return [
      [0, 6, 6],
      [6, 6, 0],
      [0, 0, 0],
    ];
    case 'Z': return [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ];
  }
}

function drawMatrix(matrix, offset, ctx, ghost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = ghost ? colors[8] : colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawGhost() {
  ghostPiece = JSON.parse(JSON.stringify(player));
  while (!collide(arena, ghostPiece)) {
    ghostPiece.pos.y++;
  }
  ghostPiece.pos.y--;
  drawMatrix(ghostPiece.matrix, ghostPiece.pos, context, true);
}

function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, {x: 0, y: 0}, context);
  drawGhost();
  drawMatrix(player.matrix, player.pos, context);
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function rotate(matrix) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  matrix.forEach(row => row.reverse());
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    arenaSweep();
    playerReset();
    updateScore();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  let dropDistance = 0;
  while (!collide(arena, player)) {
    player.pos.y++;
    dropDistance++;
  }
  player.pos.y--;
  dropDistance--;
  merge(arena, player);
  arenaSweep();
  playerReset();
  dropCounter = 0;
  player.score += dropDistance * 10;
  updateScore();
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerRotate() {
  const pos = player.pos.x;
  rotate(player.matrix);
  let offset = 1;
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix);
      rotate(player.matrix);
      rotate(player.matrix);
      player.pos.x = pos;
      return;
    }
  }
}

function playerReset() {
  if (player.next.length < 7) {
    player.next = player.next.concat(shuffle(['T','O','L','J','I','S','Z']));
  }
  const type = player.next.shift();
  player.matrix = createPiece(type);
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
  holdUsed = false;
  updateNext();
  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    updateScore();
  }
}

function playerHold() {
  if (holdUsed) return;
  const current = player.matrix;
  if (holdPiece) {
    const temp = holdPiece;
    holdPiece = current;
    player.matrix = temp;
  } else {
    holdPiece = current;
    playerReset();
  }
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
  holdUsed = true;
  updateHold();
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; y--) {
    for (let x = 0; x < arena[y].length; x++) {
      if (arena[y][x] === 0) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    rowCount++;
    y++;
  }
  if (rowCount > 0) {
    player.score += rowCount * 100;
  }
}

function updateScore() {
  document.getElementById('score').innerText = 'スコア: ' + player.score;
}

function updateNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  for (let i = 0; i < 3 && i < player.next.length; i++) {
    const mat = createPiece(player.next[i]);
    drawMatrix(mat, {x: 1, y: i * 3}, nextCtx);
  }
}

function updateHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (holdPiece) {
    drawMatrix(holdPiece, {x: 1, y: 1}, holdCtx);
  }
}

// === イベントリスナー ===
document.getElementById('left').onclick = () => playerMove(-1);
document.getElementById('right').onclick = () => playerMove(1);
document.getElementById('rotate').onclick = () => playerRotate();
document.getElementById('down').onclick = () => playerDrop();
document.getElementById('hardDrop').onclick = () => playerHardDrop();
document.getElementById('holdBtn').onclick = () => playerHold();

document.addEventListener('keydown', e => {
  switch (e.code) {
    case 'ArrowLeft': playerMove(-1); break;
    case 'ArrowRight': playerMove(1); break;
    case 'ArrowDown': playerDrop(); break;
    case 'ArrowUp': playerRotate(); break;
    case 'Space': e.preventDefault(); playerHardDrop(); break;
    case 'ShiftLeft': case 'KeyC': playerHold(); break;
  }
});

playerReset();
updateScore();
update();

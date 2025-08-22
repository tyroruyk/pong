const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');
const levelNumEl = document.getElementById('levelNum');
const speedNumEl = document.getElementById('speedNum');
const overlay = document.getElementById('overlay');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverText = document.getElementById('gameOverText');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteSoundBtn = document.getElementById('muteSoundBtn');
const difficultySelect = document.getElementById('difficultySelect');
const powerupIndicator = document.getElementById('powerupIndicator');
const controls = document.getElementById('controls');
const countdownOverlay = document.getElementById('countdownOverlay');

// Game state
let PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_MARGIN, BALL_SIZE;
let BASE_BALL_SPEED = (isMobileDevice()) ? 3 : 6;
let BASE_AI_SPEED = 4;
const WINNING_SCORE = 10;
let currentLevel = 1;
let speedMultiplier = 1.0;
let difficulty = 'medium';

let playerScore = 0, aiScore = 0;
let playerY, aiY;
let ball, particles = [], powerups = [];
let gamePaused = false, gameRunning = false, soundMuted = false;
let keys = {};

// Power-ups
let playerPowerups = {
  bigPaddle: 0,
  fastPaddle: 0,
  slowBall: 0,
  multiball: false
};

let balls = [];
let trails = [];

// Particle system
class Particle {
  constructor(x, y, vx, vy, color, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = Math.random() * 3 + 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.vy += 0.1; // gravity
    this.vx *= 0.99; // friction
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Power-up class
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 20;
    this.rotation = 0;
    this.pulsePhase = 0;
    this.collected = false;

    this.colors = {
      bigPaddle: '#ff0',
      fastPaddle: '#f0f',
      slowBall: '#0f0',
      multiball: '#f80'
    };
  }

  update() {
    this.rotation += 0.05;
    this.pulsePhase += 0.1;
  }

  draw() {
    const pulse = Math.sin(this.pulsePhase) * 0.2 + 1;
    const size = this.size * pulse;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.colors[this.type];

    ctx.fillStyle = this.colors[this.type];
    ctx.fillRect(-size/2, -size/2, size, size);

    // Inner symbol
    ctx.fillStyle = '#000';
    ctx.font = '12px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const symbols = {
      bigPaddle: '▬',
      fastPaddle: '►',
      slowBall: '●',
      multiball: '◆'
    };

    ctx.fillText(symbols[this.type], 0, 0);
    ctx.restore();
  }

  checkCollision(ballObj) {
    const dx = this.x - (ballObj.x + BALL_SIZE/2);
    const dy = this.y - (ballObj.y + BALL_SIZE/2);
    return Math.sqrt(dx*dx + dy*dy) < this.size/2 + BALL_SIZE/2;
  }
}

// Sound system
function createBeep(frequency, duration, volume = 0.3) {
  if (soundMuted) return;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'square';

  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function resizeCanvas() {
  const containerWidth = document.getElementById("gameContainer").offsetWidth;
  const aspectRatio = 800 / 500;
  canvas.width = Math.min(containerWidth, 800);
  canvas.height = canvas.width / aspectRatio;

  PADDLE_WIDTH = canvas.width * 0.012;
  PADDLE_HEIGHT = canvas.height * 0.15;
  PADDLE_MARGIN = canvas.width * 0.03;
  BALL_SIZE = canvas.width * 0.015;
}

window.addEventListener("resize", resizeCanvas);

function initGame() {
  playerScore = 0;
  aiScore = 0;
  currentLevel = 1;
  speedMultiplier = 1.0;

  updateUI();

  playerY = (canvas.height - PADDLE_HEIGHT) / 2;
  aiY = (canvas.height - PADDLE_HEIGHT) / 2;

  // Reset powerups
  playerPowerups = {
    bigPaddle: 0,
    fastPaddle: 0,
    slowBall: 0,
    multiball: false
  };

  balls = [];
  particles = [];
  powerups = [];
  trails = [];

  resetBall(Math.random() > 0.5 ? 1 : -1);

  controls.style.display = "flex";
  gamePaused = false;
  gameRunning = true;
}

function updateUI() {
  playerScoreEl.textContent = playerScore;
  aiScoreEl.textContent = aiScore;
  levelNumEl.textContent = currentLevel;
  speedNumEl.textContent = speedMultiplier.toFixed(1) + 'x';
}

function showCountdown(callback, onlyGo = false) {
  countdownOverlay.style.display = "flex";
  let steps = onlyGo ? ["Go!"] : ["3", "2", "1", "Go!"];
  let i = 0;
  function nextStep() {
    countdownOverlay.textContent = steps[i];
    i++;
    if (i < steps.length) {
      setTimeout(nextStep, 700);
    } else {
      setTimeout(() => {
        countdownOverlay.style.display = "none";
        if (callback) callback();
      }, 500);
    }
  }
  nextStep();
}

// Modify resetBall to use countdown
function resetBall(direction) {
  const speed = BASE_BALL_SPEED * speedMultiplier;
  ball = {
    x: canvas.width / 2 - BALL_SIZE / 2,
    y: canvas.height / 2 - BALL_SIZE / 2,
    vx: 0,
    vy: 0,
    trail: []
  };

  if (balls.length === 0) {
    balls = [ball];
  }

  // Show countdown before serving
  if (playerScore == 0 && aiScore == 0) {
    showCountdown(() => {
      ball.vx = speed * direction;
      ball.vy = speed * (Math.random() * 2 - 1) * 0.5;
    });
  } else {
    showCountdown(() => {
      ball.vx = speed * direction;
      ball.vy = speed * (Math.random() * 2 - 1) * 0.5;
    }, true);
  }
}

function spawnPowerUp() {
  if (powerups.length < 2 && Math.random() < 0.3) {
    const types = ['bigPaddle', 'fastPaddle', 'slowBall', 'multiball'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = canvas.width * 0.3 + Math.random() * canvas.width * 0.4;
    const y = 50 + Math.random() * (canvas.height - 100);

    powerups.push(new PowerUp(x, y, type));
  }
}

function activatePowerUp(type) {
  switch(type) {
    case 'bigPaddle':
      playerPowerups.bigPaddle = 300; // frames
      showPowerUpIndicator('Big Paddle!');
      break;
    case 'fastPaddle':
      playerPowerups.fastPaddle = 300;
      showPowerUpIndicator('Fast Paddle!');
      break;
    case 'slowBall':
      playerPowerups.slowBall = 200;
      showPowerUpIndicator('Slow Ball!');
      break;
    case 'multiball':
      if (!playerPowerups.multiball && balls.length === 1) {
        playerPowerups.multiball = true;
        // Add two more balls
        for (let i = 0; i < 2; i++) {
          const newBall = {
            x: ball.x,
            y: ball.y,
            vx: ball.vx * (0.8 + Math.random() * 0.4),
            vy: (Math.random() - 0.5) * BASE_BALL_SPEED * speedMultiplier,
            trail: []
          };
          balls.push(newBall);
        }
        showPowerUpIndicator('Multi-Ball!');
      }
      break;
  }
  createBeep(800, 0.2, 0.5);
}

function showPowerUpIndicator(text) {
  powerupIndicator.textContent = text;
  powerupIndicator.style.opacity = '1';
  setTimeout(() => {
    powerupIndicator.style.opacity = '0';
  }, 1500);
}

// Input handlers
canvas.addEventListener('mousemove', e => {
  if (!gameRunning || gamePaused) return;
  const rect = canvas.getBoundingClientRect();
  let mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  const speed = playerPowerups.fastPaddle > 0 ? 1 : 0.7;
  playerY += (mouseY - PADDLE_HEIGHT/2 - playerY) * speed;
  playerY = Math.max(0, Math.min(playerY, canvas.height - PADDLE_HEIGHT));
});

canvas.addEventListener('touchmove', e => {
  if (!gameRunning || gamePaused) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  let touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
  const speed = playerPowerups.fastPaddle > 0 ? 1 : 0.7;
  playerY += (touchY - PADDLE_HEIGHT/2 - playerY) * speed;
  playerY = Math.max(0, Math.min(playerY, canvas.height - PADDLE_HEIGHT));
}, {passive: false});

// Button events
pauseBtn.addEventListener("click", () => {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  pauseBtn.textContent = gamePaused ? "Resume" : "Pause";
  if (!gamePaused) gameLoop();
});

muteSoundBtn.addEventListener("click", () => {
  soundMuted = !soundMuted;
  muteSoundBtn.textContent = soundMuted ? "Unmute" : "Mute";
});

startBtn.addEventListener("click", () => {
  difficulty = difficultySelect.value;
  resizeCanvas();
  initGame();
  overlay.style.display = "none";
  gameLoop();
});

restartBtn.addEventListener("click", () => {
  initGame();
  gameOverScreen.style.display = "none";
  startScreen.style.display = "none";
  overlay.style.display = "none";
  gameLoop();
});

// ESC key to pause/resume
document.addEventListener("keydown", (e) => {
if (!gameRunning) return;
if (e.key === "Escape") {
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? "Resume" : "Pause";
    if (!gamePaused) gameLoop();
}
});

function draw() {
  // Clear with gradient background
  const gradient = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, 0,
    canvas.width/2, canvas.height/2, canvas.width/2
  );
  gradient.addColorStop(0, 'rgba(10,10,10,0.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.8)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid pattern
  ctx.strokeStyle = 'rgba(0,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Center line
  ctx.strokeStyle = 'rgba(0,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw particles
  particles.forEach(particle => particle.draw());

  // Draw power-ups
  powerups.forEach(powerup => powerup.draw());

  // Draw paddles with glow effect
  const playerPaddleHeight = playerPowerups.bigPaddle > 0 ? PADDLE_HEIGHT * 1.5 : PADDLE_HEIGHT;

  ctx.shadowBlur = 20;
  ctx.shadowColor = '#0ff';
  ctx.fillStyle = playerPowerups.bigPaddle > 0 ? '#ff0' : '#0ff';
  ctx.fillRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, playerPaddleHeight);

  ctx.fillStyle = '#0ff';
  ctx.fillRect(canvas.width - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);

  // Draw ball trails and balls
  balls.forEach(ballObj => {
    // Trail effect
    ballObj.trail.forEach((point, index) => {
      const alpha = index / ballObj.trail.length;
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.arc(point.x + BALL_SIZE/2, point.y + BALL_SIZE/2, BALL_SIZE/2 * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Ball with glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle = '#0ff';
    ctx.beginPath();
    ctx.arc(ballObj.x + BALL_SIZE/2, ballObj.y + BALL_SIZE/2, BALL_SIZE/2, 0, Math.PI * 2);
    ctx.fill();

    // Ball core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ballObj.x + BALL_SIZE/2, ballObj.y + BALL_SIZE/2, BALL_SIZE/4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
}

function update() {
  if (gamePaused) return;

  // Update power-up timers
  Object.keys(playerPowerups).forEach(key => {
    if (typeof playerPowerups[key] === 'number' && playerPowerups[key] > 0) {
      playerPowerups[key]--;
    }
  });

  // Update particles
  particles = particles.filter(particle => {
    particle.update();
    return particle.life > 0;
  });

  // Update power-ups
  powerups.forEach(powerup => powerup.update());

  // Spawn new power-ups occasionally
  if (Math.random() < 0.002) spawnPowerUp();

  // Update balls
  balls.forEach((ballObj, ballIndex) => {
    // Add to trail
    ballObj.trail.push({x: ballObj.x, y: ballObj.y});
    if (ballObj.trail.length > 10) ballObj.trail.shift();

    // Apply slow ball effect
    const ballSpeed = playerPowerups.slowBall > 0 ? 0.5 : 1;
    ballObj.x += ballObj.vx * ballSpeed;
    ballObj.y += ballObj.vy * ballSpeed;

    // Wall collisions
    if (ballObj.y <= 0) {
      ballObj.y = 0;
      ballObj.vy = Math.abs(ballObj.vy);
      createBeep(300, 0.1);
      addParticles(ballObj.x + BALL_SIZE/2, ballObj.y + BALL_SIZE/2, '#0ff');
    }
    if (ballObj.y + BALL_SIZE >= canvas.height) {
      ballObj.y = canvas.height - BALL_SIZE;
      ballObj.vy = -Math.abs(ballObj.vy);
      createBeep(300, 0.1);
      addParticles(ballObj.x + BALL_SIZE/2, ballObj.y + BALL_SIZE/2, '#0ff');
    }

    const paddleHeight = playerPowerups.bigPaddle > 0 ? PADDLE_HEIGHT * 1.5 : PADDLE_HEIGHT;

    // Player paddle collision
    if (ballObj.x <= PADDLE_MARGIN + PADDLE_WIDTH &&
        ballObj.x + BALL_SIZE >= PADDLE_MARGIN &&
        ballObj.y + BALL_SIZE > playerY &&
        ballObj.y < playerY + paddleHeight &&
        ballObj.vx < 0) {

      ballObj.x = PADDLE_MARGIN + PADDLE_WIDTH;
      ballObj.vx = Math.abs(ballObj.vx) * 1.05; // Increase speed slightly

      const hitPos = (ballObj.y + BALL_SIZE/2 - (playerY + paddleHeight/2)) / (paddleHeight/2);
      ballObj.vy = BASE_BALL_SPEED * speedMultiplier * hitPos * 0.7;

      createBeep(600, 0.15);
      addParticles(ballObj.x, ballObj.y + BALL_SIZE/2, '#0ff');

      // Check power-up collisions
      powerups.forEach((powerup, index) => {
        if (powerup.checkCollision(ballObj)) {
          activatePowerUp(powerup.type);
          powerups.splice(index, 1);
          addParticles(powerup.x, powerup.y, powerup.colors[powerup.type]);
        }
      });
    }

    // AI paddle collision
    if (ballObj.x + BALL_SIZE >= canvas.width - PADDLE_MARGIN - PADDLE_WIDTH &&
        ballObj.x <= canvas.width - PADDLE_MARGIN &&
        ballObj.y + BALL_SIZE > aiY &&
        ballObj.y < aiY + PADDLE_HEIGHT &&
        ballObj.vx > 0) {

      ballObj.x = canvas.width - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;
      ballObj.vx = -Math.abs(ballObj.vx) * 1.05;

      const hitPos = (ballObj.y + BALL_SIZE/2 - (aiY + PADDLE_HEIGHT/2)) / (PADDLE_HEIGHT/2);
      ballObj.vy = BASE_BALL_SPEED * speedMultiplier * hitPos * 0.7;

      createBeep(400, 0.15);
      addParticles(ballObj.x + BALL_SIZE, ballObj.y + BALL_SIZE/2, '#0ff');
    }

    // Scoring
    if (ballObj.x < -BALL_SIZE) {
      aiScore++;
      createBeep(200, 0.5);
      balls.splice(ballIndex, 1);

      if (balls.length === 0) {
        playerPowerups.multiball = false;
        if (aiScore >= WINNING_SCORE) {
          endGame("AI Wins!");
          return;
        }
        resetBall(1);
      }
    }

    if (ballObj.x > canvas.width) {
      playerScore++;
      createBeep(800, 0.5);
      balls.splice(ballIndex, 1);

      if (balls.length === 0) {
        playerPowerups.multiball = false;
        if (playerScore >= WINNING_SCORE) {
          endGame("You Win!");
          return;
        }

        // Level progression
        if (playerScore % 3 === 0) {
          currentLevel++;
          speedMultiplier += 0.05;
        }

        resetBall(-1);
      }
    }
  });

  // AI movement with improved intelligence
  const targetBall = balls.reduce((closest, ballObj) => {
    const distToBall = Math.abs(ballObj.x - (canvas.width - PADDLE_MARGIN - PADDLE_WIDTH));
    const distToClosest = Math.abs(closest.x - (canvas.width - PADDLE_MARGIN - PADDLE_WIDTH));
    return distToBall < distToClosest ? ballObj : closest;
  }, balls[0] || ball);

  if (targetBall) {
    const aiCenter = aiY + PADDLE_HEIGHT / 2;
    const ballCenter = targetBall.y + BALL_SIZE / 2;
    const aiSpeed = BASE_AI_SPEED * getDifficultyMultiplier();

    if (Math.abs(aiCenter - ballCenter) > 5) {
      if (aiCenter < ballCenter) aiY += aiSpeed;
      else aiY -= aiSpeed;
    }

    aiY = Math.max(0, Math.min(aiY, canvas.height - PADDLE_HEIGHT));
  }

  updateUI();
}

function getDifficultyMultiplier() {
  const multipliers = {
    easy: 0.6,
    medium: 0.8,
    hard: 1.0,
    insane: 1.3
  };
  return multipliers[difficulty] || 0.8;
}

function addParticles(x, y, color) {
  if (isMobileDevice()) return;
  for (let i = 0; i < 15; i++) {
    particles.push(new Particle(
      x + (Math.random() - 0.5) * 20,
      y + (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      color,
      30 + Math.random() * 20
    ));
  }
}

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function endGame(message) {
  gameRunning = false;
  controls.style.display = "none";

  // Victory particles
  const isPlayerWin = message.includes("You");
  const color = isPlayerWin ? '#0f0' : '#f00';

  for (let i = 0; i < 100; i++) {
    particles.push(new Particle(
      canvas.width / 2 + (Math.random() - 0.5) * canvas.width,
      canvas.height / 2 + (Math.random() - 0.5) * canvas.height,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      color,
      60 + Math.random() * 40
    ));
  }

  let stats = `Final Score: ${playerScore} - ${aiScore}\n`;
  stats += `Level Reached: ${currentLevel}\n`;
  stats += `Final Speed: ${speedMultiplier.toFixed(1)}x\n`;
  stats += `Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;

  gameOverText.innerHTML =
    '<div style="font-size:32px;font-family:Orbitron;text-align:center;color:#0ff;margin-bottom:16px;">Game Over</div>' +
    message + '<br><br>' + stats.replace(/\n/g, '<br>') +
    '<br><br><div style="text-align:center; font-size:14px; color:#aaa;">Open source on ' +
    '<a href="https://github.com/tyroruyk/pong" target="_blank" rel="noopener noreferrer" aria-label="CYBER PONG on GitHub (footer)" style="color:#0ff;text-decoration:underline;">GitHub</a>' +
    ' &mdash; <span style="color:#0ff;">&#9733;</span> Star us!</div>';
  startScreen.style.display = "none";
  gameOverScreen.style.display = "flex";
  overlay.style.display = "flex";

  createBeep(isPlayerWin ? 800 : 200, 1.0, 0.8);
}

function gameLoop() {
  if (!gameRunning) return;

  if (!gamePaused) {
    update();
  }

  draw();

  // Draw pause overlay
  if (gamePaused) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0ff';
    ctx.font = '48px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', canvas.width/2, canvas.height/2 - 10);

    ctx.font = '16px Orbitron';
    ctx.fillText('Click Resume to continue', canvas.width/2, canvas.height/2 + 45);
  }

  requestAnimationFrame(gameLoop);
}

// Initialize on load
resizeCanvas();

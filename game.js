// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const OBSTACLE_SPEED = 5;
const BACKGROUND_SPEED = 2;
const POWERUP_CHANCE = 0.005; // Chance per frame to spawn a power-up
const POWERUP_DURATION = 3000; // 3 seconds
const MIN_OBSTACLE_SIZE = 20;
const MAX_OBSTACLE_SIZE = 100;
const MIN_OBSTACLE_GAP = 300; // Minimum gap between obstacles

// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM elements
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const gameOverElement = document.getElementById('game-over');
const restartButton = document.getElementById('restart-btn');
const powerUpIndicator = document.getElementById('power-up-indicator');
const countdownElement = document.getElementById('countdown');

// Game variables
let gameStarted = false;
let gameOver = false;
let score = 0;
let lastObstacleTime = 0;
let backgroundX = 0;
let backgroundImage = new Image();
let isInvincible = false;
let invincibilityTimer = 0;
let invincibilityFlash = false;
let flashTimer = 0;
let powerUpDuration = 0;

// Create background pattern if no image is provided
backgroundImage.onload = function() {
    gameStarted = true;
    animate();
};
backgroundImage.onerror = function() {
    // Create a fallback pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 400;
    patternCanvas.height = 400;
    const patternCtx = patternCanvas.getContext('2d');
    
    // Draw sky pattern
    patternCtx.fillStyle = '#87CEEB';
    patternCtx.fillRect(0, 0, 400, 400);
    
    // Draw ground
    patternCtx.fillStyle = '#8B4513';
    patternCtx.fillRect(0, 350, 400, 50);
    
    // Draw some clouds
    patternCtx.fillStyle = 'white';
    patternCtx.beginPath();
    patternCtx.arc(100, 80, 30, 0, Math.PI * 2);
    patternCtx.arc(130, 60, 40, 0, Math.PI * 2);
    patternCtx.arc(160, 80, 30, 0, Math.PI * 2);
    patternCtx.fill();
    
    patternCtx.beginPath();
    patternCtx.arc(280, 120, 30, 0, Math.PI * 2);
    patternCtx.arc(310, 100, 40, 0, Math.PI * 2);
    patternCtx.arc(340, 120, 30, 0, Math.PI * 2);
    patternCtx.fill();
    
    // Convert to image
    backgroundImage.src = patternCanvas.toDataURL();
};

// Set background image or use fallback
// Trigger the fallback mechanism immediately since we don't have a background.jpg
backgroundImage.src = 'background.jpg';  // This will trigger the onerror handler

// Stroller object
const stroller = {
    x: 100,
    y: GAME_HEIGHT - 100,
    width: 50,
    height: 80,
    speed: 0,
    jumping: false,
    crouching: false,
    originalHeight: 80,
    crouchHeight: 40,
    
    update: function() {
        // Apply gravity
        this.speed += GRAVITY;
        this.y += this.speed;
        
        // Floor collision
        const floorY = GAME_HEIGHT - this.height;
        if (this.y > floorY) {
            this.y = floorY;
            this.speed = 0;
            this.jumping = false;
        }
    },
    
    jump: function() {
        if (!this.jumping && !this.crouching) {
            this.jumping = true;
            this.speed = JUMP_FORCE;
        }
    },
    
    crouch: function() {
        if (!this.jumping && !this.crouching) {
            this.crouching = true;
            this.height = this.crouchHeight;
            this.y = GAME_HEIGHT - this.height;
        }
    },
    
    standUp: function() {
        if (this.crouching) {
            this.crouching = false;
            this.height = this.originalHeight;
            this.y = GAME_HEIGHT - this.height;
        }
    },
    
    draw: function() {
        ctx.save();
        
        // Flash effect when invincible
        if (isInvincible && invincibilityFlash) {
            ctx.globalAlpha = 0.7;
        }
        
        // Draw the stroller (placeholder graphics)
        ctx.fillStyle = '#FF6347';
        
        // Base/wheels
        ctx.fillRect(this.x, this.y + this.height - 15, this.width, 15);
        
        // Body
        const bodyHeight = this.crouching ? 25 : 65;
        ctx.fillRect(this.x + 5, this.y + this.height - 15 - bodyHeight, this.width - 10, bodyHeight);
        
        // Handle
        if (!this.crouching) {
            ctx.fillRect(this.x + this.width - 10, this.y + 10, 5, this.height - 20);
        }
        
        ctx.restore();
    },
    
    getHitbox: function() {
        return {
            x: this.x + 5,
            y: this.y,
            width: this.width - 10,
            height: this.height
        };
    }
};

// Arrays for game objects
const obstacles = [];
const powerUps = [];

// Obstacle creation
function createObstacle() {
    const size = Math.floor(Math.random() * (MAX_OBSTACLE_SIZE - MIN_OBSTACLE_SIZE + 1)) + MIN_OBSTACLE_SIZE;
    
    // Randomize height (either on ground or in air)
    let y;
    const placement = Math.random();
    
    if (placement < 0.6) {
        // Ground obstacle
        y = GAME_HEIGHT - size;
    } else {
        // Air obstacle, positioned where the stroller would be when jumping
        y = GAME_HEIGHT - size - 140 + Math.random() * 50;
    }
    
    obstacles.push({
        x: GAME_WIDTH,
        y: y,
        width: size,
        height: size,
        passed: false
    });
}

// Power-up creation
function createPowerUp() {
    powerUps.push({
        x: GAME_WIDTH,
        y: GAME_HEIGHT - 200 - Math.random() * 100, // Hovering in mid-air
        width: 30,
        height: 30,
        collected: false
    });
}

// Check for collision between two rectangles (precise edge detection)
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Draw background
function drawBackground() {
    // Clear the background area first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate how many images we need to fill the screen width
    const bgWidth = backgroundImage.width || canvas.width;
    const bgHeight = backgroundImage.height || canvas.height;
    
    // Calculate the position of the first image that is visible
    const firstVisibleX = backgroundX % bgWidth;
    
    // Determine the vertical positioning to anchor to bottom
    let sourceY = 0;
    let destY = 0;
    let drawHeight = bgHeight;
    
    // If the background image is taller than the canvas, 
    // we'll only show the bottom portion of the image
    if (bgHeight > canvas.height) {
        sourceY = bgHeight - canvas.height; // Start from this position in the original image
        drawHeight = canvas.height; // Only draw this much of the height
    } else {
        // If the image is shorter than the canvas, position it at the bottom
        destY = canvas.height - bgHeight;
    }
    
    // Draw enough copies to cover the entire canvas width and one more for smooth scrolling
    let currentX = firstVisibleX - bgWidth; // Start one image width to the left
    
    while (currentX < canvas.width) {
        ctx.drawImage(
            backgroundImage, 
            0, sourceY, // Source X and Y (start from sourceY to get bottom portion)
            bgWidth, drawHeight, // Source width and height
            currentX, destY, // Destination X and Y (position at bottom if needed)
            bgWidth, drawHeight // Destination width and height
        );
        currentX += bgWidth;
    }
    
    // Move background to create scrolling effect
    backgroundX -= BACKGROUND_SPEED;
    
    // Keep backgroundX within a reasonable range to prevent floating point issues over time
    if (backgroundX < -10000) backgroundX = backgroundX % bgWidth;
}

// Update game state
function update() {
    if (gameOver) return;
    
    // Update score (time-based)
    score += 1/60;  // Approximately 1 point per second
    scoreElement.textContent = `Score: ${Math.floor(score)}`;
    
    // Update stroller
    stroller.update();
    
    // Generate obstacles
    const currentTime = Date.now();
    if (currentTime - lastObstacleTime > MIN_OBSTACLE_GAP / (1 + score/100)) {
        createObstacle();
        lastObstacleTime = currentTime;
        
        // Chance to create a power-up
        if (Math.random() < POWERUP_CHANCE) {
            createPowerUp();
        }
    }
    
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= OBSTACLE_SPEED + score/100;  // Increase speed over time
        
        // Check collisions if not invincible
        if (!isInvincible && checkCollision(stroller.getHitbox(), obstacle)) {
            endGame();
        }
        
        // Remove obstacles that have gone off screen
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }
    
    // Update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.x -= OBSTACLE_SPEED;
        
        // Check collection
        if (!powerUp.collected && checkCollision(stroller.getHitbox(), powerUp)) {
            collectPowerUp(powerUp);
        }
        
        // Remove power-ups that have gone off screen
        if (powerUp.x + powerUp.width < 0) {
            powerUps.splice(i, 1);
        }
    }
    
    // Update invincibility
    if (isInvincible) {
        powerUpDuration -= 16; // Approx 16ms per frame
        
        // Update countdown display
        const secondsLeft = Math.ceil(powerUpDuration / 1000);
        countdownElement.textContent = secondsLeft;
        
        // Flash effect
        flashTimer += 16;
        if (flashTimer >= 100) { // Toggle every 100ms
            invincibilityFlash = !invincibilityFlash;
            flashTimer = 0;
        }
        
        // End invincibility when timer runs out
        if (powerUpDuration <= 0) {
            disableInvincibility();
        }
    }
}

// Collect power-up
function collectPowerUp(powerUp) {
    powerUp.collected = true;
    enableInvincibility();
}

// Enable invincibility
function enableInvincibility() {
    isInvincible = true;
    powerUpDuration = POWERUP_DURATION;
    powerUpIndicator.style.display = 'block';
    countdownElement.textContent = Math.ceil(powerUpDuration / 1000);
}

// Disable invincibility
function disableInvincibility() {
    isInvincible = false;
    invincibilityFlash = false;
    flashTimer = 0;
    powerUpIndicator.style.display = 'none';
}

// Render game
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    // Draw obstacles
    obstacles.forEach(obstacle => {
        ctx.fillStyle = '#4682B4'; // SteelBlue color
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
    
    // Draw power-ups
    powerUps.forEach(powerUp => {
        if (!powerUp.collected) {
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.arc(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, 
                    powerUp.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Star pattern inside
            ctx.fillStyle = 'white';
            ctx.beginPath();
            const centerX = powerUp.x + powerUp.width/2;
            const centerY = powerUp.y + powerUp.height/2;
            const radius = powerUp.width/4;
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI/2;
                ctx.lineTo(
                    centerX + radius * Math.cos(angle),
                    centerY + radius * Math.sin(angle)
                );
            }
            ctx.fill();
        }
    });
    
    // Draw stroller
    stroller.draw();
}

// Game loop
function animate() {
    if (!gameStarted) return;
    
    update();
    render();
    
    if (!gameOver) {
        requestAnimationFrame(animate);
    }
}

// End game
function endGame() {
    gameOver = true;
    finalScoreElement.textContent = Math.floor(score);
    gameOverElement.style.display = 'block';
}

// Restart game
function restartGame() {
    // Reset game variables
    score = 0;
    gameOver = false;
    obstacles.length = 0;
    powerUps.length = 0;
    lastObstacleTime = Date.now();
    disableInvincibility();
    
    // Reset stroller
    stroller.y = GAME_HEIGHT - stroller.originalHeight;
    stroller.height = stroller.originalHeight;
    stroller.speed = 0;
    stroller.jumping = false;
    stroller.crouching = false;
    
    // Hide game over screen
    gameOverElement.style.display = 'none';
    
    // Start game loop
    animate();
}

// Event listeners
document.addEventListener('keydown', function(e) {
    if (gameOver) return;
    
    switch(e.key) {
        case 'ArrowUp':
        case ' ':  // Spacebar
            stroller.jump();
            break;
        case 'ArrowDown':
            stroller.crouch();
            break;
    }
});

document.addEventListener('keyup', function(e) {
    if (gameOver) return;
    
    if (e.key === 'ArrowDown') {
        stroller.standUp();
    }
});

restartButton.addEventListener('click', restartGame);

// Start the game when everything is loaded
window.addEventListener('load', function() {
    // The game will start once the background image is loaded
    // or the fallback pattern is created
});

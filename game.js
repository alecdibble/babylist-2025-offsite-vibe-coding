/**
 * Stroller Dash - Side-scrolling Obstacle Avoidance Game
 * ======================================================
 * 
 * Game Overview:
 * This game features a stroller that continuously moves forward (side-scrolling).
 * The player can make the stroller jump (up arrow) or crouch (down arrow) to avoid
 * randomly generated square obstacles of varying sizes. The goal is to survive as
 * long as possible, with the score increasing based on survival time.
 * 
 * Key Features:
 * - Side-scrolling gameplay with continuously moving background
 * - Stroller character that can jump and crouch
 * - Randomly generated square obstacles of varying sizes (20x20 to 100x100 pixels)
 * - Background image support with bottom-anchoring (tall images show bottom portion)
 * - Precise edge-based collision detection
 * - Invincibility power-ups that appear randomly
 * - Survival time-based scoring system
 * - Game over screen with restart option
 * 
 * Control Scheme:
 * - Up Arrow / Spacebar: Hold to charge jump, release to jump (longer hold = higher jump)
 * - Down Arrow: Crouch (compress stroller by 50% height)
 * 
 * Code Structure:
 * - Asset loading: Background and stroller images with fallback generation
 * - Game objects: Stroller, obstacles, power-ups with their own properties and methods
 * - Game loop: Animation, update and render cycles
 * - Event handling: Keyboard controls and collision detection
 * - UI management: Score display, power-up indicators, game over screen
 * 
 * Created as part of the Babylist 2025 project
 */

// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const GRAVITY = 0.25;
const MIN_JUMP_FORCE = -7;  // Minimum jump force (quick tap)
const MAX_JUMP_FORCE = -10; // Maximum jump force (fully charged)
const JUMP_CHARGE_RATE = 0.01; // How quickly jump force increases while holding
const OBSTACLE_SPEED = 5;
const BACKGROUND_SPEED = 2;
const POWERUP_CHANCE = 0.2; // Chance per frame to spawn a power-up
const POWERUP_DURATION = 3000; // 3 seconds
const MIN_OBSTACLE_SIZE = 40;
const MAX_OBSTACLE_SIZE = 100;
const MIN_OBSTACLE_GAP = 1000; // Minimum gap between obstacles

// Stroller configuration
const STROLLER_WIDTH = 100;
const STROLLER_HEIGHT = 100;
const STROLLER_CROUCH_HEIGHT_RATIO = 0.5; // 50% of original height when crouching

// Obstacle images object - maps obstacle names to image URLs
// This allows for future customization of behavior based on obstacle type
const OBSTACLE_IMAGES = {
    "bear": "obstacles/bear.png",
    "bottle": "obstacles/bottle.png",
    "shaker": "obstacles/shaker.png",
    "ball": "obstacles/ball.png",
    "blocks": "obstacles/blocks.png",
    "binky": "obstacles/binky.png",
    "ducky": "obstacles/ducky.png",
    "car": "obstacles/car.png",
};

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

// Preload obstacle images and handle loading errors
const obstacleImagesCache = {};
let obstacleImagesLoaded = 0;
const totalObstacleImages = Object.keys(OBSTACLE_IMAGES).length;

Object.entries(OBSTACLE_IMAGES).forEach(([name, url]) => {
    const img = new Image();
    
    img.onload = function() {
        obstacleImagesLoaded++;
        obstacleImagesCache[name] = img;
    };
    
    img.onerror = function() {
        console.log(`Failed to load image for ${name}, using fallback`);
        // Create a fallback colored square
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 64;
        fallbackCanvas.height = 64;
        const fallbackCtx = fallbackCanvas.getContext('2d');
        
        // Use different colors for different obstacle types
        let color;
        switch(name) {
            case 'rock': color = '#8B4513'; break; // Brown
            case 'box': color = '#D2691E'; break; // Chocolate
            case 'crate': color = '#CD853F'; break; // Peru
            case 'barrier': color = '#A52A2A'; break; // Brown
            case 'cone': color = '#FF8C00'; break; // Dark Orange
            default: color = '#4682B4'; break; // Steel Blue
        }
        
        fallbackCtx.fillStyle = color;
        fallbackCtx.fillRect(0, 0, 64, 64);
        
        // Add some texture/detail
        fallbackCtx.strokeStyle = 'rgba(0,0,0,0.3)';
        fallbackCtx.lineWidth = 2;
        fallbackCtx.strokeRect(5, 5, 54, 54);
        
        img.src = fallbackCanvas.toDataURL();
        obstacleImagesCache[name] = img;
        obstacleImagesLoaded++;
    };
    
    img.src = url;
});

// Game variables
let gameStarted = false;
let gameOver = false;
let score = 0;
let lastObstacleTime = 0;
let backgroundX = 0;
let backgroundImage = new Image();
let strollerImage = new Image();
let isInvincible = false;
let invincibilityTimer = 0;
let invincibilityFlash = false;
let flashTimer = 0;
let powerUpDuration = 0;
let assetsLoaded = 0;
let totalAssets = 3; // Background, stroller images, and background music
let backgroundMusic = new Audio();
let isMusicPlaying = false;
let babyCryingSound = new Audio('baby_crying.mp3');

// Asset loading management
function checkAllAssetsLoaded() {
    assetsLoaded++;
    if (assetsLoaded >= totalAssets) {
        // Assets are loaded but we won't start the game automatically
        // Instead, we'll wait for the splash screen click
        document.getElementById('splash-screen').style.cursor = 'pointer';
    }
}

// Load background image
backgroundImage.onload = function() {
    checkAllAssetsLoaded();
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

// Load stroller image
strollerImage.onload = function() {
    checkAllAssetsLoaded();
};

strollerImage.onerror = function() {
    // Create a fallback square stroller if image fails to load
    console.log("Failed to load stroller image, using fallback");
    const strollerCanvas = document.createElement('canvas');
    strollerCanvas.width = STROLLER_WIDTH;
    strollerCanvas.height = STROLLER_HEIGHT;
    const strollerCtx = strollerCanvas.getContext('2d');
    
    // Draw a simple stroller shape
    strollerCtx.fillStyle = '#FF6347';
    strollerCtx.fillRect(0, 0, STROLLER_WIDTH, STROLLER_HEIGHT);
    
    strollerImage.src = strollerCanvas.toDataURL();
};

// Set background and stroller images or use fallbacks
backgroundImage.src = 'background.jpg';
strollerImage.src = 'stroller.png';

// Load background music
backgroundMusic.src = 'baby_song.mp3';
backgroundMusic.loop = true;
backgroundMusic.volume = 0.7;

// Handle background music loading
backgroundMusic.oncanplaythrough = function() {
    checkAllAssetsLoaded();
};

backgroundMusic.onerror = function() {
    console.log("Failed to load background music");
    checkAllAssetsLoaded(); // Continue even if music fails to load
};

// Function to play background music
function playBackgroundMusic() {
    if (!isMusicPlaying) {
        backgroundMusic.play()
            .then(() => {
                isMusicPlaying = true;
            })
            .catch(err => {
                console.log("Error playing background music:", err);
            });
    }
}

// Function to pause background music
function pauseBackgroundMusic() {
    if (isMusicPlaying) {
        backgroundMusic.pause();
        isMusicPlaying = false;
    }
}

// Stroller object
const stroller = {
    x: 100,
    y: GAME_HEIGHT - STROLLER_HEIGHT,
    width: STROLLER_WIDTH,
    height: STROLLER_HEIGHT,
    speed: 0,
    jumping: false,
    crouching: false,
    originalHeight: STROLLER_HEIGHT,
    crouchHeight: STROLLER_HEIGHT * STROLLER_CROUCH_HEIGHT_RATIO,
    jumpCharging: false,
    jumpChargeTime: 0,
    jumpForce: MIN_JUMP_FORCE,
    
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
    
    startJumpCharge: function() {
        if (!this.jumping && !this.crouching) {
            // Immediately jump
            this.jumping = true;
            this.speed = MIN_JUMP_FORCE;
            
            // Start charging for additional height
            this.jumpCharging = true;
            this.jumpChargeTime = 0;
        }
    },
    
    executeJump: function() {
        // Stop charging when key is released
        this.jumpCharging = false;
    },
    
    updateJumpCharge: function() {
        if (this.jumpCharging && this.jumping) {
            this.jumpChargeTime++;
            
            // Only apply additional force if the stroller is still moving upward
            if (this.speed < 0) {
                // Calculate additional boost based on charge time
                const additionalForce = Math.min(this.jumpChargeTime * JUMP_CHARGE_RATE, Math.abs(MAX_JUMP_FORCE - MIN_JUMP_FORCE));
                
                // Continuously boost the upward speed while charging
                this.speed = Math.max(MIN_JUMP_FORCE - additionalForce, MAX_JUMP_FORCE);
            } else {
                // If we're no longer moving upward, stop charging
                this.jumpCharging = false;
            }
        }
    },
    
    jump: function() {
        // Legacy method for backward compatibility
        if (!this.jumping && !this.crouching) {
            this.jumping = true;
            this.speed = MIN_JUMP_FORCE;
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
        
        // Draw the stroller using the image
        if (this.crouching) {
            // When crouching, draw the image compressed vertically (50% height)
            ctx.drawImage(
                strollerImage,
                0, 0, strollerImage.width, strollerImage.height, // Source rectangle
                this.x, this.y, this.width, this.height          // Destination rectangle (compressed height)
            );
        } else {
            // Normal state, draw at full dimensions
            ctx.drawImage(
                strollerImage,
                0, 0, strollerImage.width, strollerImage.height, // Source rectangle
                this.x, this.y, this.width, this.height          // Destination rectangle
            );
        }
        
        // Draw jump charge indicator if charging
        if (this.jumpCharging) {
            this.drawJumpChargeIndicator();
        }
        
        ctx.restore();
    },
    
    drawJumpChargeIndicator: function() {
        // Calculate charge percentage (0 to 1) based on charge time
        const maxChargeTime = Math.abs(MAX_JUMP_FORCE - MIN_JUMP_FORCE) / JUMP_CHARGE_RATE;
        const chargePercent = Math.min(1, this.jumpChargeTime / maxChargeTime);
        
        const barWidth = this.width;
        const barHeight = 5;
        const barX = this.x;
        const barY = this.y - 15; // Position above the stroller
        
        // Draw background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw charge progress
        // Color changes from yellow to red as charge increases
        const r = Math.floor(255);
        const g = Math.floor(255 * (1 - chargePercent * 0.8));
        const b = 0;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(barX, barY, barWidth * chargePercent, barHeight);
        
        // Draw border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
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
        // Position between 2-3x the stroller height to ensure they're jumpable
        y = GAME_HEIGHT - size - (STROLLER_HEIGHT * (2 + Math.random()));
    }
    
    // Select a random obstacle type from the OBSTACLE_IMAGES object
    const obstacleTypes = Object.keys(OBSTACLE_IMAGES);
    const randomType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    
    obstacles.push({
        x: GAME_WIDTH,
        y: y,
        width: size,
        height: size,
        passed: false,
        type: randomType // Store the obstacle type
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
    
    // Update jump charge if in charging state
    stroller.updateJumpCharge();
    
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
        powerUpDuration -= 32; // Approx 16ms per frame
        
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
        // Make sure the type exists and the corresponding image is loaded
        if (obstacle.type && obstacleImagesCache[obstacle.type]) {
            try {
                // Draw the obstacle using its image
                ctx.drawImage(
                    obstacleImagesCache[obstacle.type],
                    0, 0, obstacleImagesCache[obstacle.type].width, obstacleImagesCache[obstacle.type].height, // Source rectangle
                    obstacle.x, obstacle.y, obstacle.width, obstacle.height // Destination rectangle
                );
            } catch (e) {
                // In case of any rendering errors, fall back to rectangle
                console.log("Error rendering obstacle image, using fallback:", e);
                ctx.fillStyle = '#4682B4'; // SteelBlue color
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        } else {
            // Fallback to rectangle if image not available
            ctx.fillStyle = '#4682B4'; // SteelBlue color
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
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
    pauseBackgroundMusic();
    
    // Play baby crying sound when game ends
    babyCryingSound.play().catch(err => {
        console.log("Error playing baby crying sound:", err);
    });
}

// Restart game
function restartGame() {
    // Stop baby crying sound when restarting
    babyCryingSound.pause();
    babyCryingSound.currentTime = 0;
    
    // Reset game variables
    score = 0;
    gameOver = false;
    obstacles.length = 0;
    powerUps.length = 0;
    lastObstacleTime = Date.now();
    disableInvincibility();
    playBackgroundMusic();
    
    // Reset stroller
    stroller.y = GAME_HEIGHT - stroller.originalHeight;
    stroller.height = stroller.originalHeight;
    stroller.speed = 0;
    stroller.jumping = false;
    stroller.crouching = false;
    stroller.jumpCharging = false;
    stroller.jumpChargeTime = 0;
    stroller.jumpForce = MIN_JUMP_FORCE;
    
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
            stroller.startJumpCharge();
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
    } else if (e.key === 'ArrowUp' || e.key === ' ') {
        stroller.executeJump();
    }
});

restartButton.addEventListener('click', restartGame);

// Function to start the game
function startGame() {
    if (!gameStarted) {
        // Hide splash screen
        document.getElementById('splash-screen').style.display = 'none';
        
        // Start the game
        gameStarted = true;
        animate();
        playBackgroundMusic();
        
        // Reset game time/obstacles
        lastObstacleTime = Date.now();
    }
}

// Start the game when splash screen is clicked
document.getElementById('splash-screen').addEventListener('click', startGame);

// Start the game when any key is pressed
document.addEventListener('keydown', function(e) {
    if (!gameStarted) {
        startGame();
    }
});

// Start loading everything when page loads
window.addEventListener('load', function() {
    // The assets will load but game won't start until splash screen is clicked
});

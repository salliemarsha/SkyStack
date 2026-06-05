//import Phaser from 'phaser';

const BLOCK_HEIGHT = 50;
const DROP_HEIGHT = 220;
const BASE_Y = 680;
const VIEWPORT_TARGET_Y = 520;

const STATES = {
    START: 'START',
    PLAYING: 'PLAYING',
    DROPPING: 'DROPPING',
    GAMEOVER: 'GAMEOVER'
};

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.gameState = STATES.START;
    }

    init(data) {
        this.startImmediate = data && data.startImmediate;
        this.score = 0;
        this.combo = 0;
        this.currentWidth = 220;
        this.placedBlocks = [];
        this.movingBlock = null;
        this.movingDirection = 1;
        this.cameraTargetScrollY = 0;
        this.highScore = parseInt(localStorage.getItem('skystack_highscore') || '0', 10);
        this.audioCtx = null;
        
        this.stars = [];
        const w = this.cameras.main ? this.cameras.main.width : 450;
        const h = this.cameras.main ? this.cameras.main.height : 800;
        for (let i = 0; i < 25; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 1.5 + 0.5,
                alphaOffset: Math.random() * Math.PI * 2,
                speed: 0.001 + Math.random() * 0.002
            });
        }
    }

    create() {
        const { width, height } = this.cameras.main;

        // Static background graphics
        this.bgGraphics = this.add.graphics().setScrollFactor(0).setDepth(0);

        // Draw static backdrop silhouettes
        this.drawSkylineBackdrop();

        // Setup input bindings
        this.input.keyboard.on('keydown-SPACE', () => this.handleAction());
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            // Ignore if clicking on a UI button (any interactive object)
            if (currentlyOver.length > 0) return;
            this.handleAction();
        });

        // Initialize UI Containers
        this.createGameUI();
        this.createStartScreen();
        this.createGameOverScreen();

        // Check initial state
        if (this.startImmediate) {
            this.startGame();
        } else {
            this.showStartScreen();
        }
    }

    // --- UI CREATION METHODS ---

    createGameUI() {
        const { centerX } = this.cameras.main;
        this.gameUIContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(10);

        this.scoreText = this.add.text(centerX, 230, '0', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '180px',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.05)'
        }).setOrigin(0.5);

        this.highScoreDashboard = this.add.text(25, 25, `BEST: ${this.highScore}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.4)'
        });

        this.gameUIContainer.add([this.scoreText, this.highScoreDashboard]);
        this.gameUIContainer.setVisible(false);
    }

    createStartScreen() {
        const { width, height, centerX, centerY } = this.cameras.main;
        this.startScreenContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Dark Overlay
        const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.6);
        
        // Floating particles (simple implementation using graphics)
        this.startParticles = [];
        for (let i = 0; i < 15; i++) {
            const p = this.add.circle(
                Math.random() * width, 
                Math.random() * height, 
                Math.random() * 3 + 1, 
                0xffffff, 
                Math.random() * 0.3 + 0.1
            );
            this.startScreenContainer.add(p);
            this.startParticles.push({
                obj: p,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5
            });
        }

        // Title
        this.startTitle = this.add.text(centerX, centerY - 140, 'SKYSTACK', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '64px',
            fontWeight: '900',
            color: '#ffffff',
        }).setOrigin(0.5);

        // Floating animation for title
        this.tweens.add({
            targets: this.startTitle,
            y: centerY - 150,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            loop: -1
        });

        // Subtitle
        const subtitle = this.add.text(centerX, centerY - 70, 'Build the tallest tower possible', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#ff79c6',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Instructions
        const instructions = this.add.text(centerX, centerY + 20, 'Tap or press SPACE to drop blocks', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            align: 'center'
        }).setOrigin(0.5);

        // Start Button
        const startBtn = this.add.container(centerX, centerY + 120);
        const btnBg = this.add.rectangle(0, 0, 220, 60, 0xff79c6, 1).setInteractive({ useHandCursor: true });
        const btnText = this.add.text(0, 0, 'START', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        startBtn.add([btnBg, btnText]);

        // Pulsing animation for button
        this.tweens.add({
            targets: startBtn,
            scale: 1.05,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            loop: -1
        });

        btnBg.on('pointerover', () => {
            btnBg.setFillStyle(0xff8bd2);
        });

        btnBg.on('pointerout', () => {
            btnBg.setFillStyle(0xff79c6);
        });

        btnBg.on('pointerup', () => {
            this.startGame();
        });

        this.startScreenContainer.add([overlay, this.startTitle, subtitle, instructions, startBtn]);
        this.startScreenContainer.setVisible(false);
    }

    createGameOverScreen() {
        const { width, height, centerX, centerY } = this.cameras.main;
        this.gameOverContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

        // Dark Overlay
        const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.8);

        // Modal Card
        const cardWidth = 340;
        const cardHeight = 400;
        this.gameOverCard = this.add.container(centerX, centerY);
        
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x13111c, 1);
        cardBg.fillRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 20);
        cardBg.lineStyle(2, 0xff5555, 0.3);
        cardBg.strokeRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 20);

        const title = this.add.text(0, -140, 'GAME OVER', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '42px',
            fontWeight: '900',
            color: '#ff5555'
        }).setOrigin(0.5);

        const finalScoreLabel = this.add.text(0, -50, 'Final Height', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.5)'
        }).setOrigin(0.5);

        this.finalScoreText = this.add.text(0, 0, '0', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '80px',
            fontWeight: '900',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.bestScoreText = this.add.text(0, 70, 'Best Height: 0', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#50fa7b'
        }).setOrigin(0.5);

        // Restart Button
        const restartBtn = this.add.container(0, 140);
        const btnBg = this.add.rectangle(0, 0, 200, 50, 0xff79c6, 1).setInteractive({ useHandCursor: true });
        const btnText = this.add.text(0, 0, 'TRY AGAIN', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        restartBtn.add([btnBg, btnText]);

        btnBg.on('pointerover', () => {
            btnBg.setFillStyle(0xff8bd2);
            restartBtn.setScale(1.05);
        });

        btnBg.on('pointerout', () => {
            btnBg.setFillStyle(0xff79c6);
            restartBtn.setScale(1);
        });

        btnBg.on('pointerup', () => {
            this.scene.restart({ startImmediate: true });
        });

        this.gameOverCard.add([cardBg, title, finalScoreLabel, this.finalScoreText, this.bestScoreText, restartBtn]);
        this.gameOverContainer.add([overlay, this.gameOverCard]);
        this.gameOverContainer.setVisible(false);
    }

    // --- STATE MANAGEMENT METHODS ---

    resetGameLogic() {
        // Reset tracking variables
        this.score = 0;
        this.combo = 0;
        this.currentWidth = 220;
        this.cameraTargetScrollY = 0;
        if (this.cameras.main) this.cameras.main.scrollY = 0;

        // Clear existing blocks
        this.placedBlocks.forEach(b => b.rect.destroy());
        this.placedBlocks = [];
        
        if (this.movingBlock) {
            this.movingBlock.destroy();
            this.movingBlock = null;
        }

        // Add base concrete lobby block
        const color = this.getRandomPastelColor(0);
        const { centerX } = this.cameras.main;
        this.addPlacedBlock(centerX, BASE_Y, this.currentWidth, color);
    }

    showStartScreen() {
        this.gameState = STATES.START;
        this.hideGameUI();
        this.hideGameOverScreen();
        
        this.startScreenContainer.setVisible(true);
        this.startScreenContainer.alpha = 0;
        this.tweens.add({
            targets: this.startScreenContainer,
            alpha: 1,
            duration: 500
        });

        // Initialize background with a base block
        this.resetGameLogic();
    }

    hideStartScreen() {
        this.tweens.add({
            targets: this.startScreenContainer,
            alpha: 0,
            duration: 300,
            onComplete: () => this.startScreenContainer.setVisible(false)
        });
    }

    showGameUI() {
        this.gameUIContainer.setVisible(true);
        this.scoreText.setText('0');
        this.highScoreDashboard.setText(`BEST: ${this.highScore}`);
    }

    hideGameUI() {
        this.gameUIContainer.setVisible(false);
    }

    showGameOverScreen() {
        this.gameState = STATES.GAMEOVER;
        this.hideGameUI();
        
        this.gameOverContainer.setVisible(true);
        this.gameOverContainer.alpha = 0;
        this.gameOverCard.setScale(0.8);

        this.finalScoreText.setText('0');
        this.bestScoreText.setText(`Best Height: ${this.highScore}`);

        // Fade in overlay
        this.tweens.add({
            targets: this.gameOverContainer,
            alpha: 1,
            duration: 400
        });

        // Scale in modal
        this.tweens.add({
            targets: this.gameOverCard,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Score count-up animation
        let displayScore = 0;
        this.tweens.add({
            targets: { val: 0 },
            val: this.score,
            duration: 1000,
            delay: 400,
            onUpdate: (tween) => {
                displayScore = Math.floor(tween.getValue());
                this.finalScoreText.setText(displayScore.toString());
            }
        });
    }

    hideGameOverScreen() {
        this.tweens.add({
            targets: this.gameOverContainer,
            alpha: 0,
            duration: 300,
            onComplete: () => this.gameOverContainer.setVisible(false)
        });
    }

    startGame() {
        this.resetGameLogic();
        this.hideStartScreen();
        this.hideGameOverScreen();
        this.showGameUI();
        
        this.gameState = STATES.PLAYING;
        this.spawnBlock();
    }

    gameOver() {
        this.gameState = STATES.GAMEOVER;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('skystack_highscore', this.highScore.toString());
        }

        this.showGameOverScreen();
    }

    // --- GAMEPLAY LOGIC ---

    handleAction() {
        if (this.gameState === STATES.PLAYING) {
            this.dropBlock();
        }
    }

    spawnBlock() {
        if (this.gameState !== STATES.PLAYING) return;

        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        if (!topBlock) {
            console.error("spawnBlock failed: No topBlock found in placedBlocks");
            return;
        }

        const targetY = topBlock.y - BLOCK_HEIGHT;
        const spawnY = targetY - DROP_HEIGHT;

        const color = this.getRandomPastelColor(this.placedBlocks.length);
        const { width } = this.cameras.main;

        const startFromLeft = this.placedBlocks.length % 2 === 0;
        const startX = startFromLeft ? -this.currentWidth / 2 : width + this.currentWidth / 2;
        this.movingDirection = startFromLeft ? 1 : -1;

        this.movingBlock = this.createBuildingBlock(startX, spawnY, this.currentWidth, BLOCK_HEIGHT, color);
        this.movingBlock.setDepth(12);

        this.physics.add.existing(this.movingBlock);
        this.movingBlock.body.setAllowGravity(false);
        this.movingBlock.body.setSize(this.currentWidth, BLOCK_HEIGHT);
        this.movingBlock.body.setOffset(-this.currentWidth / 2, -BLOCK_HEIGHT / 2);

        const baseSpeed = 330;
        const speedMultiplier = Math.min(1 + (this.score * 0.04), 2.2);
        const speed = baseSpeed * speedMultiplier;
        this.movingBlock.body.setVelocityX(speed * this.movingDirection);
    }

    dropBlock() {
        if (!this.movingBlock || this.gameState !== STATES.PLAYING) return;
        this.gameState = STATES.DROPPING;
        this.movingBlock.body.setVelocityX(0);
        this.movingBlock.body.setAllowGravity(true);
        this.movingBlock.body.setGravityY(1600);
    }

    handleBlockLanding() {
        const block = this.movingBlock;
        this.movingBlock = null;
        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        
        if (block && block.body) {
            block.body.stop();
            block.body.enable = false;
        }

        block.y = topBlock.rect.y - BLOCK_HEIGHT;
        const success = this.sliceBlock(block, topBlock);

        if (success) {
            this.score++;
            this.scoreText.setText(this.score.toString());

            const newTopBlock = this.placedBlocks[this.placedBlocks.length - 1];
            if (newTopBlock.y < VIEWPORT_TARGET_Y) {
                this.cameraTargetScrollY = newTopBlock.y - VIEWPORT_TARGET_Y;
            } else {
                this.cameraTargetScrollY = 0;
            }

            this.gameState = STATES.PLAYING;
            this.spawnBlock();
        }
    }

    sliceBlock(movingBlock, topBlock) {
        const diff = movingBlock.x - topBlock.x;
        const targetY = topBlock.y - BLOCK_HEIGHT;

        if (Math.abs(diff) <= 3.5) {
            this.handlePerfectPlacement(topBlock, movingBlock);
            return true;
        }

        if (Math.abs(diff) >= this.currentWidth) {
            this.handleMissedPlacement(movingBlock);
            return false;
        }

        const newWidth = this.currentWidth - Math.abs(diff);
        const newX = topBlock.x + (diff / 2);

        const sliceWidth = Math.abs(diff);
        let sliceX = diff > 0 ? newX + (newWidth / 2) + (sliceWidth / 2) : newX - (newWidth / 2) - (sliceWidth / 2);

        this.createFallingSlice(sliceX, targetY, sliceWidth, movingBlock.blockColor, diff, movingBlock.blockSeed);
        this.cameras.main.shake(70, 0.005);

        this.currentWidth = newWidth;
        this.combo = 0;

        const placed = this.addPlacedBlock(newX, targetY, newWidth, movingBlock.blockColor, movingBlock.blockSeed);
        this.applyLandingImpact(placed);
        this.playBeep(false);
        movingBlock.destroy();
        return true;
    }

    handlePerfectPlacement(topBlock, movingBlock) {
        const newX = topBlock.x;
        const targetY = topBlock.y - BLOCK_HEIGHT;
        this.combo++;

        this.playBeep(true);
        this.showFloatingText(`PERFECT! x${this.combo}`, newX, targetY - 25, '#00ffcc');

        if (this.combo > 0 && this.combo % 3 === 0) {
            const prevWidth = this.currentWidth;
            this.currentWidth = Math.min(220, this.currentWidth + 15);
            if (this.currentWidth > prevWidth) {
                this.showFloatingText('+ WIDER FLOOR', newX, targetY - 48, '#ff79c6');
            }
        }

        const placed = this.addPlacedBlock(newX, targetY, this.currentWidth, movingBlock.blockColor, movingBlock.blockSeed);
        this.applyLandingImpact(placed);

        const flash = this.add.rectangle(newX, targetY, this.currentWidth, BLOCK_HEIGHT, 0xffffff);
        flash.setDepth(11);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 250,
            onComplete: () => flash.destroy()
        });

        movingBlock.destroy();
    }

    handleMissedPlacement(movingBlock) {
        this.playBeep(false);
        this.cameras.main.shake(250, 0.016);
        
        if (movingBlock.body) {
            movingBlock.body.checkCollision.none = true;
            movingBlock.body.setAngularVelocity(this.movingDirection * 180);
        }
        
        this.time.delayedCall(800, () => {
            movingBlock.destroy();
            this.gameOver();
        });
    }

    createFallingSlice(x, y, width, color, diff, seed) {
        const slice = this.createBuildingBlock(x, y, width, BLOCK_HEIGHT, color, seed);
        slice.setDepth(11);
        this.physics.add.existing(slice);
        slice.body.setAllowGravity(true);
        const pushX = diff > 0 ? 150 : -150;
        slice.body.setVelocity(pushX, -120);
        slice.body.setAngularVelocity(diff > 0 ? 180 : -180);
        this.time.delayedCall(1200, () => slice.destroy());
    }

    addPlacedBlock(x, y, width, color, seed = null) {
        const isBase = this.placedBlocks.length === 0;

        if (this.placedBlocks.length > 0) {
            const prev = this.placedBlocks[this.placedBlocks.length - 1];
            prev.isTop = false;
            const prevIsBase = this.placedBlocks.length === 1;
            this.drawBuildingSection(prev.rect, prev.width, BLOCK_HEIGHT, prev.color, prev.rect.blockSeed, false, prevIsBase);
        }

        const rect = this.createBuildingBlock(x, y, width, BLOCK_HEIGHT, color, seed);
        rect.setDepth(10);
        this.physics.add.existing(rect, true);
        rect.body.setSize(width, BLOCK_HEIGHT);
        rect.body.setOffset(-width / 2, -BLOCK_HEIGHT / 2);

        this.placedBlocks.push({ x, y, width, color, rect, isTop: true });
        this.drawBuildingSection(rect, width, BLOCK_HEIGHT, color, rect.blockSeed, true, isBase);

        return rect;
    }

    // --- UTILS & RENDERING ---

    drawSkylineBackdrop() {
        const { height } = this.cameras.main;
        const g = this.add.graphics().setScrollFactor(0).setDepth(1);
        
        g.fillStyle(0x1b1928, 0.45);
        g.fillRect(15, height - 120, 75, 120);
        g.fillRect(80, height - 160, 65, 160);
        g.fillRect(135, height - 110, 60, 110);
        g.fillRect(235, height - 150, 85, 150);
        g.fillRect(310, height - 170, 80, 170);
        g.fillRect(380, height - 120, 55, 120);
        
        g.fillStyle(0x12101b, 0.75);
        g.fillRect(-10, height - 80, 85, 80);
        g.fillRect(65, height - 105, 80, 105);
        g.fillRect(170, height - 75, 85, 75);
        g.fillRect(245, height - 95, 75, 95);
        g.fillRect(315, height - 85, 145, 85);
    }

    createBuildingBlock(x, y, width, height, color, seed = null) {
        const graphics = this.add.graphics({ x, y });
        graphics.blockColor = color;
        graphics.blockWidth = width;
        graphics.blockSeed = seed !== null ? seed : Math.random() * 10000;
        this.drawBuildingSection(graphics, width, height, color, graphics.blockSeed, false, false);
        return graphics;
    }

    drawBuildingSection(graphics, width, height, color, seed, isTop = false, isBase = false) {
        graphics.clear();
        if (isTop) this.drawRoofAccessory(graphics, width, color, seed);

        if (isBase) {
            const baseColor = 0x3d3c45;
            graphics.fillStyle(baseColor, 1);
            graphics.fillRect(-width / 2, -height / 2, width, height);
            graphics.fillStyle(0x000000, 0.15);
            graphics.fillRect(width / 2 - 10, -height / 2, 10, height);
            graphics.fillRect(-width / 2, height / 2 - 6, width, 6);
            graphics.fillStyle(0xffffff, 0.2);
            graphics.fillRect(-width / 2 - 3, -height / 2, width + 6, 5);
            const doorWidth = Math.min(width - 40, 30);
            if (doorWidth > 10) {
                graphics.fillStyle(0xfffae0, 0.95);
                graphics.fillRect(-doorWidth / 2, height / 2 - 30, doorWidth, 24);
                graphics.lineStyle(1.5, 0x111115, 0.6);
                graphics.strokeRect(-doorWidth / 2, height / 2 - 30, doorWidth, 24);
                graphics.lineStyle(1, 0x111115, 0.4);
                graphics.lineBetween(0, height / 2 - 30, 0, height / 2 - 6);
            }
            graphics.fillStyle(0x52515b, 1);
            graphics.fillRect(-width / 2 + 10, -height / 2 + 5, 8, height - 11);
            graphics.fillRect(width / 2 - 18, -height / 2 + 5, 8, height - 11);
            return;
        }

        graphics.fillStyle(color, 1);
        graphics.fillRect(-width / 2, -height / 2, width, height);
        graphics.fillStyle(0x000000, 0.12);
        graphics.fillRect(width / 2 - 10, -height / 2, 10, height);
        graphics.fillRect(-width / 2, height / 2 - 6, width, 6);
        graphics.fillStyle(0xffffff, 0.22);
        graphics.fillRect(-width / 2 - 3, -height / 2, width + 6, 4);
        graphics.fillRect(-width / 2 - 1, height / 2 - 4, width + 2, 3);

        const rand = (offset = 0) => {
            const x = Math.sin(seed + offset) * 10000;
            return x - Math.floor(x);
        };
        const buildingStyle = Math.floor(rand(1) * 3);
        const winWidth = 7, winHeight = 10, spacingX = 9;
        const cols = Math.floor((width - 15) / (winWidth + spacingX));
        if (cols > 0) {
            const startX = -((cols - 1) * (winWidth + spacingX)) / 2;
            const rowOffsets = [-12, 10];
            rowOffsets.forEach((rowY, rIndex) => {
                for (let c = 0; c < cols; c++) {
                    const lightNoise = rand(c * 7 + rIndex * 13 + 47);
                    const isLightOn = lightNoise > 0.35;
                    const wx = startX + c * (winWidth + spacingX) - winWidth / 2;
                    const wy = rowY - winHeight / 2;
                    if (isLightOn) {
                        graphics.fillStyle(0xffe082, 0.95);
                        graphics.fillRect(wx, wy, winWidth, winHeight);
                        graphics.fillStyle(0xffffff, 0.4);
                        graphics.fillRect(wx + 1, wy + 1, 2, winHeight - 2);
                    } else {
                        graphics.fillStyle(0x181822, 0.85);
                        graphics.fillRect(wx, wy, winWidth, winHeight);
                    }
                    graphics.lineStyle(1, 0x000000, 0.2);
                    graphics.strokeRect(wx, wy, winWidth, winHeight);
                    if (buildingStyle === 1 && rIndex === 1 && c % 2 === 0) {
                        graphics.fillStyle(0xdddddd, 0.85);
                        graphics.fillRect(wx - 2, wy + 5, winWidth + 4, 6);
                        graphics.fillStyle(0x444444, 0.5);
                        graphics.fillRect(wx - 2, wy + 5, winWidth + 4, 1.5);
                        graphics.fillRect(wx - 2, wy + 10, winWidth + 4, 1.5);
                    }
                }
            });
        }
    }

    drawRoofAccessory(graphics, width, color, seedVal) {
        const seed = seedVal * 153.25;
        const rand = (offset = 0) => {
            const x = Math.sin(seed + offset) * 10000;
            return x - Math.floor(x);
        };
        const yTop = -BLOCK_HEIGHT / 2;
        let accessoryType = Math.floor(rand(1) * 3);
        if (width < 45) accessoryType = 0;
        
        if (accessoryType === 0) {
            graphics.fillStyle(0xcccccc, 1);
            graphics.fillRect(-1.5, yTop - 22, 3, 22);
            graphics.fillStyle(0xff5555, 1);
            graphics.fillCircle(0, yTop - 24, 2.5);
        } else if (accessoryType === 1) {
            graphics.fillStyle(0x888888, 1);
            graphics.fillRect(-10, yTop - 10, 7, 10);
            graphics.fillRect(3, yTop - 10, 7, 10);
            graphics.fillStyle(0x222222, 1);
            graphics.fillRect(-9, yTop - 10, 5, 1.5);
            graphics.fillRect(4, yTop - 10, 5, 1.5);
        } else {
            graphics.fillStyle(0x90a4ae, 1);
            graphics.fillRect(-8, yTop - 15, 16, 12);
            graphics.fillStyle(0x37474f, 1);
            graphics.fillRect(-10, yTop - 18, 20, 3);
            graphics.fillStyle(0x546e7a, 1);
            graphics.fillRect(-6, yTop - 3, 1.5, 3);
            graphics.fillRect(4, yTop - 3, 1.5, 3);
        }
    }

    applyLandingImpact(rect) {
        this.tweens.add({
            targets: rect,
            scaleY: 0.84,
            scaleX: 1.05,
            y: rect.y + 4.0, 
            yoyo: true,
            duration: 90,
            ease: 'Quad.easeInOut'
        });
    }

    showFloatingText(msg, x, y, color) {
        const txt = this.add.text(x, y, msg, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            fontWeight: '900',
            color: color,
            stroke: '#111115',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(20);
        txt.setScale(0.3);
        this.tweens.add({ targets: txt, scale: 1, y: y - 30, duration: 250, ease: 'Back.easeOut' });
        this.tweens.add({ targets: txt, y: y - 80, alpha: 0, delay: 450, duration: 450, ease: 'Sine.easeIn', onComplete: () => txt.destroy() });
    }

    updateBackground(time) {
        const { width, height } = this.cameras.main;
        const heightRatio = Math.min(this.score / 35, 1);
        const timeOffset = Math.sin(time / 4500) * 0.04;
        const finalRatio = Phaser.Math.Clamp(heightRatio + timeOffset, 0, 1);
        const topColor = this.blendColors(0x151124, 0x05050a, finalRatio);
        const bottomColor = this.blendColors(0x2f1b34, 0x0e0e18, finalRatio);
        this.bgGraphics.clear();
        this.bgGraphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
        this.bgGraphics.fillRect(0, 0, width, height);
        this.stars.forEach(star => {
            const starAlpha = 0.2 + 0.8 * ((Math.sin(time * star.speed + star.alphaOffset) + 1) / 2);
            this.bgGraphics.fillStyle(0xffffff, starAlpha);
            this.bgGraphics.fillRect(star.x, star.y, star.size, star.size);
        });
    }

    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xff, g1 = (color1 >> 8) & 0xff, b1 = color1 & 0xff;
        const r2 = (color2 >> 16) & 0xff, g2 = (color2 >> 8) & 0xff, b2 = color2 & 0xff;
        const r = Math.round(r1 + (r2 - r1) * ratio), g = Math.round(g1 + (g2 - g1) * ratio), b = Math.round(b1 + (b2 - b1) * ratio);
        return (r << 16) + (g << 8) + b;
    }

    getRandomPastelColor(index) {
        const hue = (index * 24) % 360;
        const colorObj = Phaser.Display.Color.HSLToColor(hue / 360, 0.75, 0.65);
        return colorObj.color;
    }

    initAudio() {
        if (window.skystack_audioCtx) { this.audioCtx = window.skystack_audioCtx; return; }
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) { window.skystack_audioCtx = new AudioContext(); this.audioCtx = window.skystack_audioCtx; }
        } catch (e) { console.warn("AudioContext init skipped."); }
    }

    playBeep(isPerfect) {
        this.initAudio();
        if (!this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator(), gain = this.audioCtx.createGain();
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            if (isPerfect) {
                osc.frequency.setValueAtTime(659.25, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(987.77, this.audioCtx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.14);
                osc.start(); osc.stop(this.audioCtx.currentTime + 0.14);
            } else {
                osc.frequency.setValueAtTime(329.63, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
                osc.start(); osc.stop(this.audioCtx.currentTime + 0.08);
            }
        } catch (e) {}
    }

    update(time, delta) {
        this.updateBackground(time);
        const { width, height } = this.cameras.main;

        // Update Start Screen Particles
        if (this.gameState === STATES.START) {
            this.startParticles.forEach(p => {
                p.obj.x += p.vx;
                p.obj.y += p.vy;
                if (p.obj.x < 0) p.obj.x = width;
                if (p.obj.x > width) p.obj.x = 0;
                if (p.obj.y < 0) p.obj.y = height;
                if (p.obj.y > height) p.obj.y = 0;
            });
        }

        if (this.gameState === STATES.PLAYING && this.movingBlock) {
            const baseSpeed = 330;
            const speedMultiplier = Math.min(1 + (this.score * 0.04), 2.2);
            const speed = baseSpeed * speedMultiplier;
            this.movingBlock.body.setVelocityX(speed * this.movingDirection);
            const halfWidth = this.currentWidth / 2;
            if (this.movingDirection === 1 && this.movingBlock.x >= width - halfWidth) {
                this.movingBlock.x = width - halfWidth;
                this.movingDirection = -1;
                this.movingBlock.body.setVelocityX(-speed);
            } else if (this.movingDirection === -1 && this.movingBlock.x <= halfWidth) {
                this.movingBlock.x = halfWidth;
                this.movingDirection = 1;
                this.movingBlock.body.setVelocityX(speed);
            }
        } else if (this.gameState === STATES.DROPPING && this.movingBlock) {
            const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
            const targetY = topBlock.y - BLOCK_HEIGHT;
            if (this.movingBlock.y >= targetY) {
                this.movingBlock.y = targetY;
                const diff = this.movingBlock.x - topBlock.x;
                if (Math.abs(diff) >= this.currentWidth) {
                    const block = this.movingBlock;
                    this.movingBlock = null;
                    this.handleMissedPlacement(block);
                } else {
                    this.handleBlockLanding();
                }
            }
        }

        this.cameras.main.scrollY = Phaser.Math.Linear(
            this.cameras.main.scrollY,
            this.cameraTargetScrollY,
            0.08
        );
    }
}

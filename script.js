(() => {
    "use strict";

    const game = document.getElementById("game");
    const bird = document.getElementById("bird");
    const birdFrame = document.getElementById("bird-frame");
    const pipeLayer = document.getElementById("pipe-layer");
    const groundStrip = document.querySelector(".ground > div");
    const skyBack = document.querySelector(".sky-back");
    const skyFront = document.querySelector(".sky-front");
    const scoreElement = document.getElementById("score");
    const bestScoreElement = document.getElementById("best-score");
    const startScreen = document.getElementById("start-screen");
    const gameOverScreen = document.getElementById("game-over-screen");
    const finalScoreElement = document.getElementById("final-score");
    const finalBestElement = document.getElementById("final-best");
    const newRecordElement = document.getElementById("new-record");
    const startButton = document.getElementById("start-button");
    const restartButton = document.getElementById("restart-button");
    const effects = document.getElementById("effects");

    const birdFrames = Array.from({ length: 7 }, (_, index) =>
        `Flappy Bird Assets/Player/StyleBird1/Bird1-${index + 1}.png`
    );

    const state = {
        phase: "ready",
        score: 0,
        best: Number.parseInt(localStorage.getItem("flappy-skyline-best") || "0", 10),
        birdY: 0,
        velocity: 0,
        pipes: [],
        lastTime: 0,
        spawnTimer: 0,
        animTimer: 0,
        frameIndex: 0,
        worldOffset: 0,
        raf: 0
    };

    const metrics = {
        width: 0,
        height: 0,
        playHeight: 0,
        groundHeight: 0,
        birdX: 0,
        birdWidth: 0,
        birdHeight: 0,
        pipeWidth: 0
    };

    bestScoreElement.textContent = state.best;

    function measure() {
        const gameRect = game.getBoundingClientRect();
        const birdRect = bird.getBoundingClientRect();
        const groundHeight = document.querySelector(".ground").getBoundingClientRect().height;
        metrics.width = gameRect.width;
        metrics.height = gameRect.height;
        metrics.groundHeight = groundHeight;
        metrics.playHeight = gameRect.height - groundHeight;
        metrics.birdX = gameRect.width * .27;
        metrics.birdWidth = birdRect.width;
        metrics.birdHeight = birdRect.height;
        metrics.pipeWidth = Math.min(92, Math.max(gameRect.width <= 600 ? 62 : 66, gameRect.width * (gameRect.width <= 600 ? .17 : .072)));

        if (state.phase === "ready") {
            state.birdY = metrics.playHeight * .42;
        } else {
            state.birdY = Math.min(state.birdY, metrics.playHeight - metrics.birdHeight);
        }
    }

    function difficulty() {
        const level = Math.min(state.score, 35);
        const mobile = metrics.width < 600;
        return {
            speed: (mobile ? 178 : 205) + level * 2.3,
            gap: Math.max(mobile ? 152 : 172, (mobile ? 205 : 226) - level * 1.65),
            interval: Math.max(1.25, 1.62 - level * .009),
            gravity: mobile ? 1510 : 1630,
            flap: mobile ? -485 : -515
        };
    }

    function setBirdFrame(index) {
        state.frameIndex = index % birdFrames.length;
        birdFrame.src = birdFrames[state.frameIndex];
    }

    function createPipe(x = metrics.width + metrics.pipeWidth) {
        const { gap } = difficulty();
        const safeTop = Math.max(82, metrics.playHeight * .13);
        const safeBottom = Math.max(62, metrics.playHeight * .1);
        const minCenter = safeTop + gap / 2;
        const maxCenter = metrics.playHeight - safeBottom - gap / 2;
        const center = minCenter + Math.random() * Math.max(1, maxCenter - minCenter);
        const topHeight = center - gap / 2;
        const bottomY = center + gap / 2;

        const element = document.createElement("div");
        element.className = "pipe-pair";
        element.innerHTML = `
            <div class="pipe top"><div class="pipe-shaft"></div><div class="pipe-cap"></div></div>
            <div class="pipe bottom"><div class="pipe-shaft"></div><div class="pipe-cap"></div></div>`;
        element.querySelector(".top").style.height = `${topHeight}px`;
        element.querySelector(".bottom").style.height = `${metrics.playHeight - bottomY}px`;
        element.style.transform = `translate3d(${x}px, 0, 0)`;
        pipeLayer.appendChild(element);

        state.pipes.push({ x, gapTop: topHeight, gapBottom: bottomY, scored: false, element });
    }

    function clearPipes() {
        for (const pipe of state.pipes) pipe.element.remove();
        state.pipes.length = 0;
    }

    function startGame() {
        if (state.phase === "playing") return;
        clearPipes();
        state.phase = "playing";
        state.score = 0;
        state.velocity = 0;
        state.spawnTimer = 0;
        state.animTimer = 0;
        state.worldOffset = 0;
        state.birdY = metrics.playHeight * .43;
        state.lastTime = performance.now();
        scoreElement.textContent = "0";
        startScreen.hidden = true;
        gameOverScreen.hidden = true;
        game.classList.remove("is-ready", "hit");
        bird.style.animation = "none";
        createPipe(metrics.width + Math.max(120, metrics.width * .18));
        flap();
    }

    function flap() {
        if (state.phase === "ready") {
            startGame();
            return;
        }
        if (state.phase !== "playing") return;
        state.velocity = difficulty().flap;
        state.animTimer = .075;
        setBirdFrame(1);
    }

    function addPoint(pipe) {
        pipe.scored = true;
        state.score += 1;
        scoreElement.textContent = state.score;
        scoreElement.classList.remove("pop");
        void scoreElement.offsetWidth;
        scoreElement.classList.add("pop");

        const burst = document.createElement("span");
        burst.className = "point-burst";
        burst.textContent = "+1";
        burst.style.left = `${metrics.birdX + metrics.birdWidth / 2}px`;
        burst.style.top = `${Math.max(95, state.birdY - 12)}px`;
        effects.appendChild(burst);
        burst.addEventListener("animationend", () => burst.remove(), { once: true });
    }

    function collides() {
        const insetX = metrics.birdWidth * .18;
        const insetY = metrics.birdHeight * .22;
        const left = metrics.birdX + insetX;
        const right = metrics.birdX + metrics.birdWidth - insetX;
        const top = state.birdY + insetY;
        const bottom = state.birdY + metrics.birdHeight - insetY;

        if (top <= 0 || bottom >= metrics.playHeight) return true;
        for (const pipe of state.pipes) {
            const pipeLeft = pipe.x + metrics.pipeWidth * .06;
            const pipeRight = pipe.x + metrics.pipeWidth * .94;
            const overlapsX = right > pipeLeft && left < pipeRight;
            if (overlapsX && (top < pipe.gapTop || bottom > pipe.gapBottom)) return true;
        }
        return false;
    }

    function gameOver() {
        if (state.phase !== "playing") return;
        state.phase = "over";
        game.classList.add("hit");
        const previousBest = state.best;
        state.best = Math.max(state.best, state.score);
        localStorage.setItem("flappy-skyline-best", String(state.best));
        bestScoreElement.textContent = state.best;
        finalScoreElement.textContent = state.score;
        finalBestElement.textContent = state.best;
        newRecordElement.hidden = !(state.score > previousBest && state.score > 0);
        window.setTimeout(() => { gameOverScreen.hidden = false; }, 320);
    }

    function resetToReady() {
        clearPipes();
        state.phase = "ready";
        state.score = 0;
        state.velocity = 0;
        state.worldOffset = 0;
        state.birdY = metrics.playHeight * .42;
        scoreElement.textContent = "0";
        scoreElement.classList.remove("pop");
        gameOverScreen.hidden = true;
        startScreen.hidden = false;
        game.classList.add("is-ready");
        game.classList.remove("hit");
        bird.style.animation = "";
        bird.style.transform = "";
        setBirdFrame(0);
    }

    function restart() {
        clearPipes();
        state.phase = "ready";
        gameOverScreen.hidden = true;
        game.classList.add("is-ready");
        bird.style.animation = "";
        startGame();
    }

    function update(dt) {
        const config = difficulty();
        state.velocity += config.gravity * dt;
        state.velocity = Math.min(state.velocity, 760);
        state.birdY += state.velocity * dt;
        state.spawnTimer += dt;
        state.animTimer += dt;
        state.worldOffset = (state.worldOffset + config.speed * dt) % 256;

        if (state.spawnTimer >= config.interval) {
            state.spawnTimer -= config.interval;
            createPipe();
        }

        for (let index = state.pipes.length - 1; index >= 0; index -= 1) {
            const pipe = state.pipes[index];
            pipe.x -= config.speed * dt;
            pipe.element.style.transform = `translate3d(${pipe.x}px, 0, 0)`;
            if (!pipe.scored && pipe.x + metrics.pipeWidth < metrics.birdX) addPoint(pipe);
            if (pipe.x + metrics.pipeWidth < -8) {
                pipe.element.remove();
                state.pipes.splice(index, 1);
            }
        }

        if (state.animTimer >= .085) {
            state.animTimer %= .085;
            setBirdFrame(state.frameIndex + 1);
        }
        if (collides()) gameOver();
    }

    function render() {
        bird.style.top = `${state.birdY}px`;
        if (state.phase === "playing" || state.phase === "over") {
            const rotation = Math.max(-27, Math.min(78, state.velocity * .09));
            bird.style.transform = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
        }
        const offset = state.worldOffset;
        groundStrip.style.transform = `translate3d(${-offset}px, 0, 0)`;
        skyBack.style.backgroundPosition = `${-offset * .055}px bottom`;
        skyFront.style.backgroundPosition = `${-offset * .12}px bottom`;
    }

    function loop(time) {
        const rawDt = (time - state.lastTime) / 1000;
        const dt = Math.min(.034, Math.max(0, rawDt || 0));
        state.lastTime = time;

        if (state.phase === "playing") update(dt);
        if (state.phase === "over" && state.birdY < metrics.playHeight - metrics.birdHeight) {
            state.velocity = Math.min(850, state.velocity + 1750 * dt);
            state.birdY = Math.min(metrics.playHeight - metrics.birdHeight, state.birdY + state.velocity * dt);
        }
        if (state.phase !== "playing") state.worldOffset = (state.worldOffset + 22 * dt) % 256;

        render();
        state.raf = requestAnimationFrame(loop);
    }

    function handleAction(event) {
        if (event.type === "keydown") {
            if (!["Space", "ArrowUp"].includes(event.code)) return;
            event.preventDefault();
            if (event.repeat) return;
        }
        if (event.target.closest("button")) return;
        flap();
    }

    startButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startGame();
    });
    restartButton.addEventListener("click", (event) => {
        event.stopPropagation();
        restart();
    });
    game.addEventListener("pointerdown", handleAction);
    window.addEventListener("keydown", handleAction);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", () => { state.lastTime = performance.now(); });

    for (const src of birdFrames) {
        const image = new Image();
        image.src = src;
    }

    measure();
    resetToReady();
    state.lastTime = performance.now();
    state.raf = requestAnimationFrame(loop);


    
    window.__flappyDebug = { state, metrics, start: startGame, flap, gameOver, restart, createPipe };
})();

eval("console.log('Debug info initialized')");
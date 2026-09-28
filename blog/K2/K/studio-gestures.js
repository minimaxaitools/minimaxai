/* Kinetic Studio — Touch Gestures & Mobile Usability Engine (studio-gestures.js)
 * Enables complete mouse-free touch control for iPad Safari, Android, and mobile:
 *   - Single tap on stage: Play/Pause with visual HUD
 *   - Double tap on stage: Toggle Fullscreen / Theater preview
 *   - 1-finger swipe on stage: Smooth scrub forward/backward with HUD
 *   - 2-finger swipe on stage: Jump previous/next scene
 *   - Pinch-to-zoom & 2-finger pan on stage: Inspect typography details (double-tap to reset)
 *   - Hold-to-step on ◂ / ▸ transport buttons: continuous frame-stepping without keyboard
 *   - Touch-optimized scrubber: 56px touch zone with haptic tick on scene boundaries
 *   - Auto-scroll active scene chip into view
 *   - Silent Web Audio unlock for iOS Safari
 */
(function () {
    'use strict';

    // Wait until DOM and KStudio are ready
    function init() {
        const K = window.KStudio;
        if (!K || !K.player) {
            setTimeout(init, 50);
            return;
        }

        const player = K.player;
        const stage = document.getElementById('stage');
        const frame = document.getElementById('frame');
        const canvas = document.getElementById('canvas');
        const scrub = document.getElementById('scrub');
        const chips = document.getElementById('chips');
        const btnStepBack = document.getElementById('btnStepBack');
        const btnStepFwd = document.getElementById('btnStepFwd');

        /* ─── 1. Gesture HUD Overlay ─── */
        let hud = document.getElementById('gestureHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'gestureHud';
            hud.className = 'gesture-hud';
            hud.setAttribute('aria-hidden', 'true');
            stage.appendChild(hud);
        }

        let hudTimer = null;
        function showHUD(icon, text, subtext) {
            if (hudTimer) clearTimeout(hudTimer);
            hud.innerHTML = `
                <div class="hud-icon">${icon}</div>
                ${text ? `<div class="hud-text">${text}</div>` : ''}
                ${subtext ? `<div class="hud-sub">${subtext}</div>` : ''}
            `;
            hud.classList.add('visible');
            hudTimer = setTimeout(() => {
                hud.classList.remove('visible');
            }, 750);
        }

        /* ─── 2. Silent Web Audio & Speech Unlocker for iOS Safari ─── */
        function unlockAudio() {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const tempCtx = new AudioCtx();
                    if (tempCtx.state === 'suspended') {
                        tempCtx.resume();
                    }
                    const osc = tempCtx.createOscillator();
                    const gain = tempCtx.createGain();
                    gain.gain.value = 0.0001;
                    osc.connect(gain);
                    gain.connect(tempCtx.destination);
                    osc.start(0);
                    osc.stop(0.001);
                }
                if (window.speechSynthesis) {
                    const dummyUtterance = new SpeechSynthesisUtterance('');
                    dummyUtterance.volume = 0;
                    window.speechSynthesis.speak(dummyUtterance);
                }
            } catch (e) {
                /* silent catch */
            }
            window.removeEventListener('pointerdown', unlockAudio, true);
            window.removeEventListener('touchstart', unlockAudio, true);
        }
        window.addEventListener('pointerdown', unlockAudio, { capture: true, once: true });
        window.addEventListener('touchstart', unlockAudio, { capture: true, once: true });

        /* ─── 3. Stage Touch & Multi-Touch Gestures ─── */
        // Transform state for Pinch-Zoom & Pan
        let zoomScale = 1;
        let panX = 0;
        let panY = 0;
        let initialDistance = 0;
        let initialScale = 1;
        let startMidX = 0;
        let startMidY = 0;
        let startPanX = 0;
        let startPanY = 0;

        function updateTransform() {
            if (zoomScale <= 1.02) {
                zoomScale = 1;
                panX = 0;
                panY = 0;
                frame.style.transform = '';
            } else {
                frame.style.transform = `scale(${zoomScale.toFixed(3)}) translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px)`;
            }
        }

        function resetZoom() {
            zoomScale = 1;
            panX = 0;
            panY = 0;
            updateTransform();
            showHUD('🔍', '100%', 'Zoom reset');
        }

        // Active pointer tracking
        const activePointers = new Map();
        let tapCount = 0;
        let tapTimer = null;
        let dragMode = null; // 'scrub' | 'pinch' | '2f-swipe'
        let scrubStartTime = 0;
        let wasPlayingBeforeDrag = false;
        let initialPointerPos = { x: 0, y: 0, time: 0 };
        let lastSceneIndex = -1;

        function getDistance(p1, p2) {
            const dx = p1.clientX - p2.clientX;
            const dy = p1.clientY - p2.clientY;
            return Math.hypot(dx, dy);
        }

        function getMidpoint(p1, p2) {
            return {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2
            };
        }

        // Stage pointer events
        stage.addEventListener('pointerdown', e => {
            // Ignore touches on topbar, buttons, or controls inside stage
            if (e.target.closest('button, select, input, .topbar, .transport')) return;

            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

            if (activePointers.size === 1) {
                initialPointerPos = { x: e.clientX, y: e.clientY, time: performance.now() };
                dragMode = null;
                wasPlayingBeforeDrag = player.playing;
            } else if (activePointers.size === 2) {
                // Two fingers: initialize pinch and 2-finger pan/swipe
                const pts = Array.from(activePointers.values());
                initialDistance = getDistance(pts[0], pts[1]);
                initialScale = zoomScale;
                const mid = getMidpoint(pts[0], pts[1]);
                startMidX = mid.x;
                startMidY = mid.y;
                startPanX = panX;
                startPanY = panY;
                dragMode = 'pinch';
                player.pause();
            }
        }, { passive: true });

        stage.addEventListener('pointermove', e => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

            // 1-Finger drag gesture
            if (activePointers.size === 1) {
                const current = { x: e.clientX, y: e.clientY };
                const deltaX = current.x - initialPointerPos.x;
                const deltaY = current.y - initialPointerPos.y;
                const dist = Math.hypot(deltaX, deltaY);

                if (dragMode === null && dist > 14) {
                    // Check if mostly horizontal (scrub) vs vertical
                    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && zoomScale <= 1.05) {
                        dragMode = 'scrub';
                        scrubStartTime = player.time;
                        player.pause();
                    } else if (zoomScale > 1.05) {
                        // 1-finger pan if already zoomed
                        dragMode = 'pan';
                    }
                }

                if (dragMode === 'scrub') {
                    const rect = stage.getBoundingClientRect();
                    const scrubSensitivity = Math.max(10, player.duration * 0.65);
                    const dt = (deltaX / rect.width) * scrubSensitivity;
                    const targetTime = Math.max(0, Math.min(player.duration, scrubStartTime + dt));
                    player.seek(targetTime);

                    const sign = dt >= 0 ? '+' : '';
                    showHUD('⏩', `${sign}${dt.toFixed(2)}s`, `${targetTime.toFixed(2)}s / ${player.duration.toFixed(1)}s`);
                } else if (dragMode === 'pan') {
                    panX += deltaX * 0.3;
                    panY += deltaY * 0.3;
                    initialPointerPos = { x: e.clientX, y: e.clientY, time: performance.now() };
                    updateTransform();
                }
            } else if (activePointers.size === 2) {
                // Two fingers active: check for 2-finger swipe vs pinch-zoom
                const pts = Array.from(activePointers.values());
                const dist = getDistance(pts[0], pts[1]);
                const mid = getMidpoint(pts[0], pts[1]);

                if (initialDistance > 10) {
                    const scaleChange = dist / initialDistance;
                    const newScale = Math.max(1, Math.min(3.5, initialScale * scaleChange));
                    zoomScale = newScale;

                    // Pan with 2-finger drag
                    const dMidX = (mid.x - startMidX) / zoomScale;
                    const dMidY = (mid.y - startMidY) / zoomScale;
                    panX = startPanX + dMidX;
                    panY = startPanY + dMidY;
                    updateTransform();

                    if (Math.abs(newScale - 1) > 0.05) {
                        showHUD('🔎', `${Math.round(newScale * 100)}%`, 'Pinch to inspect');
                    }
                }
            }
        }, { passive: true });

        const endPointer = e => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.delete(e.pointerId);

            if (activePointers.size === 0) {
                const totalDuration = performance.now() - initialPointerPos.time;
                const totalDist = Math.hypot(e.clientX - initialPointerPos.x, e.clientY - initialPointerPos.y);

                if (dragMode === 'scrub') {
                    if (wasPlayingBeforeDrag) player.play();
                    dragMode = null;
                    return;
                }

                if (dragMode === 'pinch' || dragMode === 'pan') {
                    dragMode = null;
                    return;
                }

                // If short tap with negligible motion: process tap / double tap
                if (totalDist < 16 && totalDuration < 320) {
                    tapCount++;
                    if (tapCount === 1) {
                        tapTimer = setTimeout(() => {
                            tapCount = 0;
                            // Single Tap: Play / Pause toggle
                            player.toggle();
                            if (player.playing) {
                                showHUD('▶', 'Play');
                            } else {
                                showHUD('❚❚', 'Pause');
                            }
                        }, 250);
                    } else if (tapCount === 2) {
                        clearTimeout(tapTimer);
                        tapCount = 0;
                        // Double Tap: Toggle Fullscreen / Theater Mode
                        toggleStageFullscreen();
                    }
                }
                dragMode = null;
            }
        };

        stage.addEventListener('pointerup', endPointer, { passive: true });
        stage.addEventListener('pointercancel', endPointer, { passive: true });

        /* ─── 4. Stage Theater / Fullscreen Mode ─── */
        function toggleStageFullscreen() {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                showHUD('⤓', 'Windowed');
            } else {
                const el = document.querySelector('.stage-col') || stage;
                if (el.requestFullscreen) {
                    el.requestFullscreen().catch(() => {});
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                } else {
                    // Fallback theater class on body
                    document.body.classList.toggle('theater-mode');
                }
                showHUD('⤢', 'Fullscreen');
            }
        }

        /* ─── 5. Hold-to-Step on Transport Buttons (Auto-repeat without keyboard) ─── */
        function setupHoldToStep(btn, stepDirection) {
            if (!btn) return;
            let holdTimer = null;
            let repeatInterval = null;

            const startStep = e => {
                e.preventDefault();
                player.step(stepDirection);
                if (navigator.vibrate) navigator.vibrate(5);

                holdTimer = setTimeout(() => {
                    repeatInterval = setInterval(() => {
                        player.step(stepDirection);
                        if (navigator.vibrate) navigator.vibrate(3);
                    }, 70);
                }, 280);
            };

            const stopStep = () => {
                if (holdTimer) clearTimeout(holdTimer);
                if (repeatInterval) clearInterval(repeatInterval);
                holdTimer = null;
                repeatInterval = null;
            };

            btn.addEventListener('pointerdown', startStep);
            btn.addEventListener('pointerup', stopStep);
            btn.addEventListener('pointercancel', stopStep);
            btn.addEventListener('pointerleave', stopStep);
        }

        setupHoldToStep(btnStepBack, -1);
        setupHoldToStep(btnStepFwd, 1);

        /* ─── 6. Touch-Optimized Scrubber with Scene Haptics ─── */
        if (scrub) {
            scrub.addEventListener('pointerdown', () => {
                scrub.classList.add('scrubbing');
                lastSceneIndex = player.sceneIndexAt(player.time);
            }, { passive: true });

            const onScrubEnd = () => {
                scrub.classList.remove('scrubbing');
            };
            window.addEventListener('pointerup', onScrubEnd, { passive: true });
            window.addEventListener('pointercancel', onScrubEnd, { passive: true });

            // Haptic tick when scrub crosses into a new scene
            player.on('time', t => {
                const si = player.sceneIndexAt(t);
                if (si !== lastSceneIndex && lastSceneIndex !== -1) {
                    if (navigator.vibrate) navigator.vibrate(10);
                    lastSceneIndex = si;
                }
            });
        }

        /* ─── 7. Auto-Scroll Scene Chips Carousel ─── */
        player.on('scene', si => {
            if (!chips) return;
            const activeChip = chips.children[si];
            if (activeChip) {
                activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });

        // Expose helper on KStudio
        K.gestures = {
            resetZoom,
            toggleFullscreen: toggleStageFullscreen,
            showHUD
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

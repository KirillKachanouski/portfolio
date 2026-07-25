(() => {
    "use strict";

    const GAMES_DATA_URL = "games.json";
    const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const body = document.body;
    const gamesGrid = document.getElementById("gamesGrid");
    const projectModal = document.getElementById("projectModal");
    const projectModalDialog = projectModal?.querySelector(".project-modal__dialog");
    const projectPreviewVideo = document.getElementById("projectPreviewVideo");
    const projectModalTitle = document.getElementById("projectModalTitle");
    const projectModalDescription = document.getElementById("projectModalDescription");
    const modalCloseElements = [...document.querySelectorAll("[data-close-modal]")];

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let revealElements = [];
    let projectCards = [];
    let lastFocusedElement = null;


    function isProjectModalOpen() {
        return projectModal?.classList.contains("is-open") ?? false;
    }


    function isCardActivationKey(key) {
        return key === "Enter" || key === " ";
    }


    async function initializePage() {
        await loadGames();

        revealElements = [...document.querySelectorAll("[data-reveal]")];
        projectCards = [...document.querySelectorAll(".js-open-project")];

        initializeRevealAnimations();
        initializeProjectModal();
        initializeGamePreviews();

        requestAnimationFrame(() => {
            body.classList.remove("is-loading");
            body.classList.add("page-ready");
        });
    }


    async function loadGames() {
        if (!gamesGrid) {
            return;
        }

        gamesGrid.setAttribute("aria-busy", "true");

        try {
            const response = await fetch(GAMES_DATA_URL);

            if (!response.ok) {
                throw new Error(`Failed to load ${GAMES_DATA_URL}`);
            }

            const games = await response.json();

            if (!Array.isArray(games)) {
                throw new Error(`${GAMES_DATA_URL} must contain an array`);
            }

            const fragment = document.createDocumentFragment();

            games.forEach((game) => {
                fragment.append(createGameCard(normalizeGame(game)));
            });

            gamesGrid.replaceChildren(fragment);
        } catch (error) {
            gamesGrid.replaceChildren(createGamesErrorMessage());
            console.error(error);
        } finally {
            gamesGrid.setAttribute("aria-busy", "false");
        }
    }


    function normalizeGame(game) {
        return {
            title: getStringValue(game, "title", "Untitled game"),
            image: getStringValue(game, "image", ""),
            video: getStringValue(game, "video", ""),
            shortVideo: getStringValue(game, "shortVideo", ""),
            shortDescription: getStringValue(game, "shortDescription", ""),
            fullDescription: getStringValue(game, "fullDescription", "")
        };
    }


    function getStringValue(source, key, fallback) {
        if (!source || typeof source[key] !== "string") {
            return fallback;
        }

        return source[key].trim() || fallback;
    }


    function createGameCard(game) {
        const card = document.createElement("article");

        card.className = "game-card js-open-project";
        card.dataset.reveal = "";
        card.dataset.previewVideo = game.shortVideo;
        card.dataset.modalVideo = game.video;
        card.dataset.title = game.title;
        card.dataset.description = game.fullDescription;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Open project ${game.title}`);

        const media = document.createElement("div");
        media.className = "game-card__media";

        const poster = document.createElement("img");
        poster.className = "game-card__poster";
        poster.src = game.image;
        poster.alt = game.title;
        poster.loading = "lazy";

        const preview = document.createElement("video");
        preview.className = "game-card__preview";
        preview.muted = true;
        preview.loop = true;
        preview.playsInline = true;
        preview.preload = "metadata";
        preview.setAttribute("aria-hidden", "true");

        media.append(poster, preview);

        const bodyContent = document.createElement("div");
        bodyContent.className = "game-card__body";

        const heading = document.createElement("div");
        heading.className = "game-card__heading";

        const title = document.createElement("h3");
        title.textContent = game.title;

        const description = document.createElement("p");
        description.className = "game-card__description";
        description.textContent = game.shortDescription;

        heading.append(title);
        bodyContent.append(heading, description);
        card.append(media, bodyContent);

        return card;
    }


    function createGamesErrorMessage() {
        const message = document.createElement("p");

        message.className = "games-grid__message";
        message.dataset.reveal = "";
        message.textContent = "Could not load games.json. Open the site through a local server and check the JSON file.";

        return message;
    }


    function initializeRevealAnimations() {
        if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
            revealElements.forEach((element) => {
                element.classList.add("is-visible");
            });

            return;
        }

        const observer = new IntersectionObserver(
            (entries, instance) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    const element = entry.target;
                    const siblingIndex = getRevealSiblingIndex(element);

                    window.setTimeout(() => {
                        element.classList.add("is-visible");
                    }, Math.min(siblingIndex * 90, 360));

                    instance.unobserve(element);
                });
            },
            {
                threshold: 0.14,
                rootMargin: "0px 0px -70px 0px"
            }
        );

        revealElements
            .filter((element) => element.dataset.reveal !== "header")
            .forEach((element) => {
                observer.observe(element);
            });
    }


    function getRevealSiblingIndex(element) {
        const parent = element.parentElement;

        if (!parent) {
            return 0;
        }

        return [...parent.children]
            .filter((child) => child.hasAttribute("data-reveal"))
            .indexOf(element);
    }


    function initializeProjectModal() {
        if (
            !projectModal ||
            !projectPreviewVideo ||
            !projectModalTitle ||
            !projectModalDescription
        ) {
            return;
        }

        projectCards.forEach((card) => {
            card.addEventListener("click", () => {
                openProjectFromCard(card);
            });

            card.addEventListener("keydown", (event) => {
                if (isCardActivationKey(event.key)) {
                    event.preventDefault();
                    openProjectFromCard(card);
                }
            });
        });

        modalCloseElements.forEach((element) => {
            element.addEventListener("click", closeProjectModal);
        });

        document.addEventListener("keydown", (event) => {
            if (!isProjectModalOpen()) {
                return;
            }

            if (event.key === "Escape") {
                closeProjectModal();
            }

            if (event.key === "Tab") {
                trapModalFocus(event);
            }
        });
    }


    function initializeGamePreviews() {
        projectCards.forEach((card) => {
            const video = card.querySelector(".game-card__preview");
            const videoSource = card.dataset.previewVideo;

            if (!(video instanceof HTMLVideoElement) || !videoSource) {
                return;
            }

            video.muted = true;
            video.addEventListener("error", () => {
                stopGamePreview(card, video);
                card.classList.add("is-preview-unavailable");
            });

            card.addEventListener("pointerenter", () => {
                startGamePreview(card, video, videoSource);
            });

            card.addEventListener("pointerleave", () => {
                stopGamePreview(card, video);
            });
        });
    }


    function startGamePreview(card, video, videoSource) {
        if (card.classList.contains("is-preview-unavailable")) {
            return;
        }

        if (!video.currentSrc) {
            video.src = videoSource;
        }

        try {
            video.currentTime = 0;
        } catch {
            // Some browsers block seeking while metadata is unavailable.
        }

        const playRequest = video.play();

        if (!playRequest) {
            card.classList.add("is-preview-playing");
            return;
        }

        playRequest
            .then(() => {
                card.classList.add("is-preview-playing");
            })
            .catch(() => {
                stopGamePreview(card, video);
            });
    }


    function stopGamePreview(card, video) {
        card.classList.remove("is-preview-playing");
        video.pause();

        try {
            video.currentTime = 0;
        } catch {
            // Some browsers block seeking while metadata is unavailable.
        }
    }


    function openProjectFromCard(card) {
        const title = card.dataset.title || "Project";
        const description = card.dataset.description || "";
        const modalVideo = card.dataset.modalVideo || "";

        if (!modalVideo) {
            window.alert("Specify a local MP4 file in games.json.");
            return;
        }

        const cardPreviewVideo = card.querySelector(".game-card__preview");

        if (cardPreviewVideo instanceof HTMLVideoElement) {
            stopGamePreview(card, cardPreviewVideo);
        }

        openProjectModal({ modalVideo, title, description });
    }


    function openProjectModal({ modalVideo, title, description }) {
        lastFocusedElement = document.activeElement;

        projectModalTitle.textContent = title;
        projectModalDescription.textContent = description;
        projectPreviewVideo.src = modalVideo;
        projectModalDialog?.scrollTo({ top: 0, left: 0 });

        projectModal.classList.add("is-open");
        projectModal.setAttribute("aria-hidden", "false");

        body.classList.add("modal-open");

        const closeButton = projectModal.querySelector(".project-modal__close");

        window.setTimeout(() => {
            closeButton?.focus();
        }, 80);

        const playRequest = projectPreviewVideo.play();

        if (playRequest) {
            playRequest.catch(() => {});
        }
    }


    function closeProjectModal() {
        projectModal.classList.remove("is-open");
        projectModal.setAttribute("aria-hidden", "true");

        projectPreviewVideo.pause();
        projectPreviewVideo.removeAttribute("src");
        projectPreviewVideo.load();

        body.classList.remove("modal-open");

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        }
    }


    function trapModalFocus(event) {
        const focusableElements = [
            ...projectModal.querySelectorAll(FOCUSABLE_SELECTOR)
        ].filter((element) => {
            return !element.hasAttribute("disabled");
        });

        if (focusableElements.length === 0) {
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }


    document.addEventListener("DOMContentLoaded", () => {
        initializePage();
    });
})();

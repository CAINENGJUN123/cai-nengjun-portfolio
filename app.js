(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  const revealElements = [...document.querySelectorAll(".reveal")];
  const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "50px 0px -8% 0px" }
    )
    : null;

  revealElements.forEach((element, index) => {
    element.style.transitionDelay = `${(index % 4) * 0.08}s`;
    if (revealObserver) {
      revealObserver.observe(element);
    } else {
      element.classList.add("in-view");
    }
  });

  document.querySelectorAll("[data-magnet]").forEach((magnet) => {
    if (reduceMotion) return;
    magnet.addEventListener("pointermove", (event) => {
      const rect = magnet.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / 3;
      const y = (event.clientY - rect.top - rect.height / 2) / 3;
      magnet.style.transition = "transform .3s ease-out";
      magnet.style.setProperty("--magnet-x", `${x}px`);
      magnet.style.setProperty("--magnet-y", `${y}px`);
    });
    magnet.addEventListener("pointerleave", () => {
      magnet.style.transition = "transform .6s ease-in-out";
      magnet.style.setProperty("--magnet-x", "0px");
      magnet.style.setProperty("--magnet-y", "0px");
    });
  });

  const animatedText = document.querySelector("[data-animated-text]");
  if (animatedText) {
    const text = animatedText.textContent;
    animatedText.textContent = "";
    [...text].forEach((character) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = character === " " ? "\u00a0" : character;
      animatedText.append(span);
    });
  }

  const marqueeRows = [...document.querySelectorAll("[data-marquee]")].map((row) => {
    const track = row.querySelector(".marquee-track");
    const original = [...track.children];
    original.forEach((child) => track.append(child.cloneNode(true)));
    original.forEach((child) => track.append(child.cloneNode(true)));
    return {
      track,
      direction: row.dataset.marquee,
      third: 0,
    };
  });

  const syncPhotoFrame = (image) => {
    const frame = image.closest("[data-photo-frame]");
    if (!frame) return;

    const hasSource = !image.hidden && Boolean(image.currentSrc || image.getAttribute("src"));
    const isLoading = hasSource && !image.complete;
    const hasPhoto = hasSource && image.complete && image.naturalWidth > 0;
    frame.classList.toggle("is-loading", isLoading);
    frame.classList.toggle("has-photo", hasPhoto);
    frame.querySelectorAll("[data-photo-copy]").forEach((copy) => {
      copy.hidden = isLoading || hasPhoto;
    });
  };

  const bindPhotoFrame = (image) => {
    if (image.dataset.photoBound === "true") return;
    image.dataset.photoBound = "true";
    image.addEventListener("load", () => syncPhotoFrame(image));
    image.addEventListener("error", () => {
      image.hidden = true;
      syncPhotoFrame(image);
    });
    syncPhotoFrame(image);
  };

  document
    .querySelectorAll("[data-photo-frame] > img[data-image-slot]")
    .forEach(bindPhotoFrame);

  const animatedCharacters = animatedText
    ? [...animatedText.querySelectorAll(".char")]
    : [];
  const projectCards = [...document.querySelectorAll("[data-project-card]")].map((card, index, cards) => ({
    card,
    stage: card.closest(".project-stage"),
    targetScale: 1 - (cards.length - 1 - index) * 0.03,
    range: 1,
  }));
  const showreel = document.querySelector(".showreel");
  let showreelTop = 0;
  let viewportHeight = window.innerHeight;
  let layoutDirty = true;
  let renderScheduled = false;
  let lastAnimatedProgress = -1;

  const measureLayout = () => {
    viewportHeight = window.innerHeight;
    showreelTop = showreel ? showreel.offsetTop : 0;
    marqueeRows.forEach((item) => {
      item.third = item.track.scrollWidth / 3;
    });
    projectCards.forEach((item) => {
      item.range = Math.max(item.stage.offsetHeight - viewportHeight, 1);
    });
    layoutDirty = false;
  };

  const renderScrollEffects = () => {
    if (showreel && !reduceMotion) {
      const offset = (window.scrollY - showreelTop + viewportHeight) * 0.3;

      marqueeRows.forEach(({ track, direction, third }) => {
        if (!third) return;
        const phase = ((offset % third) + third) % third;
        const translate = direction === "right"
          ? -third + phase
          : -phase;
        const transform = `translate3d(${translate}px, 0, 0)`;
        if (track.style.transform !== transform) {
          track.style.transform = transform;
        }
      });
    }

    if (animatedText) {
      const rect = animatedText.getBoundingClientRect();
      const progress = clamp(
        (viewportHeight * 0.8 - rect.top) /
          (rect.height + viewportHeight * 0.6),
        0,
        1
      );
      if (progress !== lastAnimatedProgress) {
        lastAnimatedProgress = progress;
        animatedCharacters.forEach((character, index) => {
          const start = index / Math.max(animatedCharacters.length, 1);
          const local = clamp((progress - start * 0.78) / 0.18, 0.18, 1);
          const opacity = String(local);
          if (character.style.opacity !== opacity) {
            character.style.opacity = opacity;
          }
        });
      }
    }

    projectCards.forEach(({ card, stage, targetScale, range }) => {
      const rect = stage.getBoundingClientRect();
      const progress = clamp(-rect.top / range, 0, 1);
      const scale = 1 - (1 - targetScale) * progress;
      const transform = `scale(${scale})`;
      if (card.style.transform !== transform) {
        card.style.transform = transform;
      }
    });
  };

  const scheduleRender = (needsMeasurement = false) => {
    if (needsMeasurement) layoutDirty = true;
    if (renderScheduled) return;
    renderScheduled = true;
    window.requestAnimationFrame(() => {
      renderScheduled = false;
      if (layoutDirty) measureLayout();
      renderScrollEffects();
    });
  };

  scheduleRender(true);
  window.addEventListener("scroll", () => scheduleRender(), { passive: true });
  window.addEventListener("resize", () => scheduleRender(true), { passive: true });

  const applyImage = (slot, url) => {
    document.querySelectorAll(`[data-image-slot="${slot}"]`).forEach((image) => {
      if (url) {
        if (slot === "profile") {
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
        }
        image.src = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
        image.hidden = false;
        syncPhotoFrame(image);
      } else if (slot !== "profile") {
        image.hidden = true;
        image.removeAttribute("src");
        syncPhotoFrame(image);
      }
    });
  };

  const applyProjectDetails = (projectDetails) => {
    if (!projectDetails || typeof projectDetails !== "object") return;

    document.querySelectorAll("[data-project-detail]").forEach((project) => {
      const detail = projectDetails[project.dataset.projectDetail];
      if (!detail || typeof detail !== "object") return;

      ["painPoints", "solutions"].forEach((field) => {
        const list = project.querySelector(`[data-project-field="${field}"]`);
        const items = Array.isArray(detail[field])
          ? detail[field]
            .filter((item) => typeof item === "string" && item.trim())
            .slice(0, 4)
          : [];
        if (!list || !items.length) return;

        const fragment = document.createDocumentFragment();
        items.forEach((item) => {
          const listItem = document.createElement("li");
          listItem.textContent = item.trim();
          fragment.append(listItem);
        });
        list.replaceChildren(fragment);
      });
    });
  };

  fetch("/api/content", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load content");
      return response.json();
    })
    .then((data) => {
      Object.entries(data.images || {}).forEach(([slot, url]) => {
        applyImage(slot, url);
      });
      applyProjectDetails(data.projectDetails);
    })
    .catch(() => {
      // Bundled defaults keep the portfolio usable without the content API.
    });
})();

document.addEventListener('DOMContentLoaded', () => {
  // === HERO VIDEO AUTOPLAY FIX ===
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.autoplay = true;
    heroVideo.loop = true;

    heroVideo.play().catch(() => {
      console.log("Autoplay blocked, forcing playback...");
      heroVideo.muted = true;
      heroVideo.play();
    });
  }

  // === ENHANCED FADE-IN ANIMATION WITH STAGGER ===
  const elements = document.querySelectorAll('.fade-in');
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, index * 100);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  elements.forEach(el => {
    el.classList.add('hidden');
    observer.observe(el);
  });

  // === ENHANCED REVEAL ANIMATION FOR CARDS ===
  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entry.target.classList.remove('is-hidden');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );

  const prepareReveal = element => {
    if (!element || element.classList.contains('reveal-prepared')) return;
    element.classList.add('reveal-prepared', 'is-hidden');
    revealObserver.observe(element);
  };

  document.querySelectorAll('.reveal-on-scroll').forEach(prepareReveal);

  // === PARALLAX SCROLL EFFECT ===
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  
  const handleParallax = () => {
    const scrolled = window.pageYOffset;
    
    parallaxElements.forEach(el => {
      const speed = el.dataset.parallax === 'slow' ? 0.3 : 0.5;
      const yPos = -(scrolled * speed);
      el.style.transform = `translateY(${yPos}px)`;
    });
  };

  if (parallaxElements.length > 0) {
    window.addEventListener('scroll', handleParallax);
  }

  // === SCROLL PROGRESS BAR ===
  const progressBar = document.querySelector('.scroll-progress .progress-bar');
  const updateProgress = () => {
    if (!progressBar) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
    progressBar.style.width = `${progress}%`;
  };

  updateProgress();
  window.addEventListener('scroll', updateProgress);
  window.addEventListener('resize', updateProgress);

  // === NAVBAR STATE ON SCROLL ===
  const navbar = document.querySelector('.navbar');
  const toggleNavbarState = () => {
    if (!navbar) return;
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  toggleNavbarState();
  window.addEventListener('scroll', toggleNavbarState);

  // === MOBILE MENU TOGGLE ===
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when clicking on a link
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }

  // === SMOOTH SCROLL FOR ANCHOR LINKS ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      
      if (target) {
        const offsetTop = target.offsetTop - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // === INTERACTIVE STORY STEPS ===
  const storySteps = document.querySelectorAll('.story-step');
  const storyMedia = document.querySelector('.story-visual-media');
  const storyTitle = document.getElementById('storyTitle');
  const storyDescription = document.getElementById('storyDescription');

  storySteps.forEach((step, index) => {
    step.addEventListener('click', () => {
      storySteps.forEach(s => s.classList.remove('is-active'));
      step.classList.add('is-active');

      const media = step.dataset.media;
      const title = step.dataset.title;
      const description = step.dataset.description;

      if (storyMedia && media) {
        storyMedia.style.backgroundImage = `url(${media})`;
      }
      if (storyTitle && title) {
        storyTitle.textContent = title;
      }
      if (storyDescription && description) {
        storyDescription.textContent = description;
      }
    });

    // Hover effect
    step.addEventListener('mouseenter', () => {
      if (!step.classList.contains('is-active')) {
        const media = step.dataset.media;
        if (storyMedia && media) {
          storyMedia.style.backgroundImage = `url(${media})`;
        }
      }
    });
  });

  // Initialize first story step
  if (storySteps.length > 0) {
    const firstStep = storySteps[0];
    const media = firstStep.dataset.media;
    if (storyMedia && media) {
      storyMedia.style.backgroundImage = `url(${media})`;
    }
  }

  // === SERVICE CARDS MAGNETIC HOVER EFFECT ===
  const serviceCards = document.querySelectorAll('.service-card');
  
  serviceCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-12px)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // === PROJECT CARDS WITH HOVER TILT ===
  // Project cards are static HTML (see index.html PROJECTS markers). The 3D tilt
  // never applied to them before (this query ran before the cards were injected),
  // so it is intentionally left off to preserve the exact prior behavior.
  const projectCards = [];
  
  projectCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-20px)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // === PROJECTS GRID ===
  // The projects grid is now static HTML in index.html (between the
  // <!-- PROJECTS:START --> / <!-- PROJECTS:END --> markers), generated by
  // tools/build-projects.js from data/projects.json. Reveal-on-scroll is
  // handled by the shared .reveal-on-scroll observer above, so no per-card
  // JavaScript injection is needed here.

  // === FORM ANIMATION ===
  const formInputs = document.querySelectorAll('.contact-form-panel input, .contact-form-panel select, .contact-form-panel textarea');
  
  formInputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', () => {
      if (!input.value) {
        input.parentElement.classList.remove('focused');
      }
    });
  });

  // === LAZY LOADING IMAGES ===
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.src; // Trigger load
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  }

  // === ANIMATED COUNTER FOR STATS (if you add stats section later) ===
  const animateCounter = (element, target, duration = 2000) => {
    let start = 0;
    const increment = target / (duration / 16);
    
    const counter = setInterval(() => {
      start += increment;
      if (start >= target) {
        element.textContent = target;
        clearInterval(counter);
      } else {
        element.textContent = Math.floor(start);
      }
    }, 16);
  };

  // === PERFORMANCE OPTIMIZATION ===
  // Debounce scroll events
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout);
    }
    scrollTimeout = window.requestAnimationFrame(() => {
      // Additional scroll-based animations can go here
    });
  }, { passive: true });

  console.log('✨ BX Media website loaded with enhanced animations!');
});

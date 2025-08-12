document.addEventListener('DOMContentLoaded', () => {
  // === HERO VIDEO AUTOPLAY FIX (For iOS Safari & Mobile) ===
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

  // === FADE-IN ANIMATION ===
  const elements = document.querySelectorAll('.fade-in');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => {
    el.classList.add('hidden');
    observer.observe(el);
  });

  // === MOBILE MENU TOGGLE ===
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  // === DYNAMIC PROJECTS ===
  const projectData = [
    {

      id: 1,
      title: "Albassami × Seven Car Lounge",
      category: "High-End Video & Content Production",
      client: "Seven Car Lounge",
      location: "Riyadh",
      image: "Projects/albassami0001.jpg"
        
      
    },
    {
      id: 2,
      title: "ArabGT × SAMF",
      category: "High-End Video & Content Production",
      client: "ArabGT",
      location: "Riyadh",
      image: "Projects/samf0001.jpg"
    },
    {
      id: 3,
      title: "Hongqi × StriveME",
      category: "High-End Video & Content Production",
      client: "Strive ME",
      location: "Riyadh",
      image: "Projects/hongqi.png"
    },
    {
      id: 4,
      title: "Toyota LC300 HEV MAX",
      category: "High-End Video & Content Production",
      client: "Abdullateef Jameel",
      location: "Riyadh",
      image: "Projects/toyotalc3000001.jpg"
    },
    {
      id: 5,
      title: "Feynlab",
      category: "High-End Video & Content Production",
      client: "Feynlab",
      location: "Riyadh",
      image: "Projects/feynlab0001.jpg"
    },
    {
      id: 6,
      title: "VIP Quick Service",
      category: "High-End Video & Content Production",
      client: "VIP Quick Service",
      location: "Riyadh",
      image: "Projects/vip00.png"
    }
  ];

  const projectsGrid = document.getElementById("projectsGrid");

  projectData.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <div class="project-image">
        <img src="${project.image}" alt="${project.title}" />
      </div>
      <div class="project-info">
        <h3>${project.title}</h3>
        <a href="#services" class="project-category">${project.category}</a>
        <div class="project-details">
          <p><strong>Client:</strong> ${project.client}</p>
          <p><strong>Location:</strong> ${project.location}</p>
        </div>
        <a href="project-details.html?id=${project.id}" class="project-btn">View Project</a>
      </div>
    `;
    projectsGrid.appendChild(card);
  });
});


/* ═══════════════════════════════════════════════════════════════════════════════ */
/* CUSTOM CURSOR ANIMATION                                                          */
/* ═══════════════════════════════════════════════════════════════════════════════ */

const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

// Track mouse position
document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top = my + 'px';
});

// Animate ring with easing
function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px';
  ring.style.top = ry + 'px';
  requestAnimationFrame(animRing);
}
animRing();

// Add cursor scale effect on interactive elements
document.querySelectorAll('a, button, .skill-card, .project-card, .testimonial-card, .exp-service').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.transform = 'translate(-50%,-50%) scale(2.5)';
    ring.style.transform = 'translate(-50%,-50%) scale(1.4)';
    ring.style.opacity = '0.4';
  });

  el.addEventListener('mouseleave', () => {
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    ring.style.transform = 'translate(-50%,-50%) scale(1)';
    ring.style.opacity = '1';
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════ */
/* NAVIGATION SCROLL EFFECT                                                         */
/* ═══════════════════════════════════════════════════════════════════════════════ */

const nav = document.getElementById('mainNav');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

/* ═══════════════════════════════════════════════════════════════════════════════ */
/* SCROLL REVEAL ANIMATIONS                                                         */
/* ═══════════════════════════════════════════════════════════════════════════════ */

const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger');

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

revealEls.forEach(el => io.observe(el));

/* ═══════════════════════════════════════════════════════════════════════════════ */
/* MOBILE NAVIGATION                                                                */
/* ═══════════════════════════════════════════════════════════════════════════════ */

function openMobileNav() {
  document.getElementById('mobileNav').classList.add('open');
}

function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════════════════════ */
/* ACTIVE NAVIGATION LINK                                                           */
/* ═══════════════════════════════════════════════════════════════════════════════ */

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => link.classList.remove('active'));
      const activeLink = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (activeLink) activeLink.classList.add('active');
    }
  });
}, {
  threshold: 0.4
});

sections.forEach(section => sectionObserver.observe(section));

/* ═══════════════════════════════════════════════════════════════════════════════ */
/* FORM SUBMISSION                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════════ */

const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = contactForm.querySelector('.form-submit');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = 'Sending... ';
  btn.disabled = true;

  try {
    // Prepare form data
    const formData = new FormData(contactForm);
    
    // Send to Formspree
    const response = await fetch('https://formspree.io/f/mqenqeda', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      btn.innerHTML = '✓ Message sent!';
      btn.style.background = 'var(--accent)';
      contactForm.reset();

      // Reset button after 3 seconds
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.background = '';
      }, 3000);
    } else {
      throw new Error('Form submission failed');
    }
  } catch (error) {
    btn.innerHTML = '✗ Error sending';
    btn.style.background = 'var(--red)';

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.style.background = '';
    }, 3000);
  }
});


/* ═══════════════════════════════════════════════════════════════════════════════ */
/* HERO PARALLAX EFFECT                                                             */
/* ═══════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('mousemove', e => {
  const { clientX: x, clientY: y } = e;
  const { innerWidth: w, innerHeight: h } = window;

  // Calculate parallax offset based on mouse position
  const dx = (x / w - 0.5) * 12;
  const dy = (y / h - 0.5) * 8;

  // Apply transform to badges
  document.querySelectorAll('.hero-badge, .hero-badge2').forEach(badge => {
    badge.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px)`;
  });
});

// Hamburger menu toggle — used on all pages
(function () {
  const toggle = document.getElementById('navbar-toggle');
  const links = document.getElementById('navbar-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when a link is clicked (mobile UX)
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
      links.classList.remove('open');
      toggle.classList.remove('open');
    }
  });
})();

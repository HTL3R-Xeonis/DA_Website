const THEME_KEY = 'xeonis-theme';
const themeToggle = document.querySelector('.theme-toggle');
const heroLogo = document.getElementById('heroLogo');

function applyLogoForTheme(theme) {
    if (!heroLogo) return;
    const src = theme === 'light' ? heroLogo.dataset.logoLight : heroLogo.dataset.logoDark;
    if (src) heroLogo.setAttribute('src', src);
}

applyLogoForTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const next = isLight ? 'dark' : 'light';

        if (next === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        localStorage.setItem(THEME_KEY, next);
        applyLogoForTheme(next);
    });
}

const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.14
});

revealElements.forEach((element) => revealObserver.observe(element));

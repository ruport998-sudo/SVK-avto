/* assets/js/main.js */
/* Minimal JavaScript for СВК Авто website */

(function() {
  'use strict';

  // Mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const mainMenu = document.getElementById('main-menu');
  
  if (menuToggle && mainMenu) {
    menuToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      mainMenu.classList.toggle('is-open');
    });
    
    // Close menu on overlay click
    document.addEventListener('click', function(e) {
      if (mainMenu.classList.contains('is-open') && 
          !mainMenu.contains(e.target) && 
          !menuToggle.contains(e.target)) {
        menuToggle.setAttribute('aria-expanded', 'false');
        mainMenu.classList.remove('is-open');
      }
    });
    
    // Close menu on link click
    mainMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        menuToggle.setAttribute('aria-expanded', 'false');
        mainMenu.classList.remove('is-open');
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Phone input mask
  const phoneInputs = document.querySelectorAll('input[type="tel"]');
  phoneInputs.forEach(input => {
    input.addEventListener('input', function(e) {
      let value = this.value.replace(/\D/g, '');
      
      if (value.length > 0) {
        if (value[0] === '7' || value[0] === '8') {
          value = value.substring(1);
        }
        
        let formattedValue = '+7';
        
        if (value.length > 0) {
          formattedValue += ' (' + value.substring(0, 3);
        }
        if (value.length >= 3) {
          formattedValue += ') ' + value.substring(3, 6);
        }
        if (value.length >= 6) {
          formattedValue += '-' + value.substring(6, 8);
        }
        if (value.length >= 8) {
          formattedValue += '-' + value.substring(8, 10);
        }
        
        this.value = formattedValue;
      }
    });
  });

  // Form validation
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add('is-invalid');
        } else {
          field.classList.remove('is-invalid');
        }
      });
      
      if (!isValid) {
        e.preventDefault();
      }
    });
  });

  // Lazy load images
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('is-loaded');
          observer.unobserve(img);
        }
      });
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));
  }

  // Header shadow on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
      const currentScroll = window.pageYOffset;
      
      if (currentScroll > 10) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
      
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // Accordion accessibility enhancement
  const detailsElements = document.querySelectorAll('details');
  detailsElements.forEach(details => {
    const summary = details.querySelector('summary');
    
    if (summary) {
      summary.addEventListener('click', function() {
        // Close other details in the same group
        const parent = details.parentElement;
        if (parent && parent.classList.contains('faq-list')) {
          detailsElements.forEach(otherDetails => {
            if (otherDetails !== details && otherDetails.hasAttribute('open')) {
              otherDetails.removeAttribute('open');
            }
          });
        }
      });
    }
  });

  // Copy to clipboard (for phone numbers)
  document.querySelectorAll('[data-copy]').forEach(element => {
    element.addEventListener('click', function(e) {
      e.preventDefault();
      const textToCopy = this.getAttribute('data-copy');
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = this.textContent;
          this.textContent = 'Скопировано!';
          setTimeout(() => {
            this.textContent = originalText;
          }, 2000);
        });
      }
    });
  });

  // Current year in footer
  const yearElements = document.querySelectorAll('.current-year');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  console.log('СВК Авто - сайт загружен');
})();

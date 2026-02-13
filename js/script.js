/* ============================================================
   BUNNIES PLUMBING & TRENCHLESS TECHNOLOGY
   Main JavaScript — Multi-Page, Vanilla JS Only
   ============================================================ */

(function () {
    'use strict';

    /* ---- DOM Elements (with null checks for multi-page) ---- */
    var header = document.getElementById('header');
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var mainNav = document.getElementById('mainNav');
    var backToTop = document.getElementById('backToTop');
    var contactForm = document.getElementById('contactForm');
    var formSuccess = document.getElementById('formSuccess');
    var reviewsTrack = document.getElementById('reviewsTrack');
    var reviewPrev = document.getElementById('reviewPrev');
    var reviewNext = document.getElementById('reviewNext');
    var reviewDots = document.getElementById('reviewDots');

    /* ============================================================
       HEADER — Scroll State
       ============================================================ */
    if (header) {
        function handleHeaderScroll() {
            if (window.scrollY > 60) {
                header.classList.add('is-scrolled');
            } else {
                header.classList.remove('is-scrolled');
            }
        }
        window.addEventListener('scroll', handleHeaderScroll, { passive: true });
        handleHeaderScroll();
    }

    /* ============================================================
       MOBILE NAVIGATION
       ============================================================ */
    if (hamburgerBtn && mainNav) {
        hamburgerBtn.addEventListener('click', function () {
            var isOpen = mainNav.classList.toggle('is-open');
            hamburgerBtn.classList.toggle('is-active');
            hamburgerBtn.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        mainNav.querySelectorAll('.header__nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                mainNav.classList.remove('is-open');
                hamburgerBtn.classList.remove('is-active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });
    }

    /* ============================================================
       BACK TO TOP BUTTON
       ============================================================ */
    if (backToTop) {
        function handleBackToTop() {
            if (window.scrollY > 500) {
                backToTop.classList.add('is-visible');
            } else {
                backToTop.classList.remove('is-visible');
            }
        }
        window.addEventListener('scroll', handleBackToTop, { passive: true });
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ============================================================
       SCROLL ANIMATIONS — Intersection Observer
       ============================================================ */
    var animatedElements = document.querySelectorAll('.animate-on-scroll');

    if (animatedElements.length > 0) {
        if ('IntersectionObserver' in window) {
            var animObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        animObserver.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.15,
                rootMargin: '0px 0px -40px 0px'
            });

            animatedElements.forEach(function (el) {
                animObserver.observe(el);
            });
        } else {
            animatedElements.forEach(function (el) {
                el.classList.add('is-visible');
            });
        }
    }

    /* ============================================================
       STAT COUNTER ANIMATION
       ============================================================ */
    var statNumbers = document.querySelectorAll('.stats__number[data-target]');
    var statsAnimated = false;

    function animateCounters() {
        if (statsAnimated) return;
        statsAnimated = true;

        statNumbers.forEach(function (el) {
            var target = parseFloat(el.getAttribute('data-target'));
            var isDecimal = el.hasAttribute('data-decimal');
            var duration = 2000;
            var startTime = null;

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                var progress = Math.min((timestamp - startTime) / duration, 1);
                var easedProgress = 1 - Math.pow(1 - progress, 3);
                var current = easedProgress * target;

                if (isDecimal) {
                    el.textContent = current.toFixed(1);
                } else {
                    el.textContent = Math.floor(current);
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    el.textContent = isDecimal ? target.toFixed(1) : target;
                }
            }

            requestAnimationFrame(step);
        });
    }

    var statsSection = document.querySelector('.stats');
    if (statsSection && statNumbers.length > 0 && 'IntersectionObserver' in window) {
        var statsObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounters();
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        statsObserver.observe(statsSection);
    }

    /* ============================================================
       REVIEWS CAROUSEL (only on pages with carousel)
       ============================================================ */
    if (reviewsTrack) {
        var reviewCards = reviewsTrack.children;
        var totalReviews = reviewCards.length;
        var currentReview = 0;
        var reviewsPerView = 1;
        var autoPlayTimer = null;

        function getReviewsPerView() {
            if (window.innerWidth >= 1024) return 3;
            if (window.innerWidth >= 768) return 2;
            return 1;
        }

        function getTotalPages() {
            return Math.max(1, totalReviews - reviewsPerView + 1);
        }

        function updateCarousel() {
            var cardWidth = 100 / reviewsPerView;
            for (var i = 0; i < totalReviews; i++) {
                reviewCards[i].style.flex = '0 0 ' + cardWidth + '%';
            }
            var offset = -(currentReview * cardWidth);
            reviewsTrack.style.transform = 'translateX(' + offset + '%)';
            updateDots();
        }

        function createDots() {
            if (!reviewDots) return;
            reviewDots.innerHTML = '';
            var totalPages = getTotalPages();
            for (var i = 0; i < totalPages; i++) {
                var dot = document.createElement('button');
                dot.className = 'reviews__dot' + (i === currentReview ? ' is-active' : '');
                dot.setAttribute('aria-label', 'Go to review ' + (i + 1));
                dot.dataset.index = i;
                dot.addEventListener('click', function () {
                    goToReview(parseInt(this.dataset.index));
                });
                reviewDots.appendChild(dot);
            }
        }

        function updateDots() {
            if (!reviewDots) return;
            var dots = reviewDots.querySelectorAll('.reviews__dot');
            dots.forEach(function (dot, idx) {
                dot.classList.toggle('is-active', idx === currentReview);
            });
        }

        function goToReview(index) {
            var maxIndex = getTotalPages() - 1;
            currentReview = Math.max(0, Math.min(index, maxIndex));
            updateCarousel();
            resetAutoPlay();
        }

        function nextReview() {
            var maxIndex = getTotalPages() - 1;
            currentReview >= maxIndex ? goToReview(0) : goToReview(currentReview + 1);
        }

        function prevReview() {
            var maxIndex = getTotalPages() - 1;
            currentReview <= 0 ? goToReview(maxIndex) : goToReview(currentReview - 1);
        }

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayTimer = setInterval(nextReview, 5000);
        }

        function stopAutoPlay() {
            if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
        }

        function resetAutoPlay() {
            stopAutoPlay();
            startAutoPlay();
        }

        if (reviewPrev) reviewPrev.addEventListener('click', prevReview);
        if (reviewNext) reviewNext.addEventListener('click', nextReview);

        // Touch support
        var touchStartX = 0;
        reviewsTrack.addEventListener('touchstart', function (e) {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        reviewsTrack.addEventListener('touchend', function (e) {
            var diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? nextReview() : prevReview();
            }
            startAutoPlay();
        }, { passive: true });

        window.addEventListener('resize', function () {
            var newPerView = getReviewsPerView();
            if (newPerView !== reviewsPerView) {
                reviewsPerView = newPerView;
                currentReview = 0;
                createDots();
                updateCarousel();
            }
        });

        // Init
        reviewsPerView = getReviewsPerView();
        createDots();
        updateCarousel();
        startAutoPlay();
    }

    /* ============================================================
       CONTACT / BOOKING FORM VALIDATION
       ============================================================ */
    function showError(inputId, errorId, message) {
        var input = document.getElementById(inputId);
        var error = document.getElementById(errorId);
        if (input) input.classList.add('is-error');
        if (error) error.textContent = message;
    }

    function clearError(inputId, errorId) {
        var input = document.getElementById(inputId);
        var error = document.getElementById(errorId);
        if (input) input.classList.remove('is-error');
        if (error) error.textContent = '';
    }

    function validateForm() {
        var isValid = true;

        var nameEl = document.getElementById('formName');
        var phoneEl = document.getElementById('formPhone');
        var emailEl = document.getElementById('formEmail');
        var serviceEl = document.getElementById('formService');

        if (nameEl) {
            var nameVal = nameEl.value.trim();
            if (!nameVal) {
                showError('formName', 'nameError', 'Please enter your name.');
                isValid = false;
            } else if (nameVal.length < 2) {
                showError('formName', 'nameError', 'Name must be at least 2 characters.');
                isValid = false;
            } else {
                clearError('formName', 'nameError');
            }
        }

        if (phoneEl) {
            var phoneVal = phoneEl.value.trim();
            var phoneDigits = phoneVal.replace(/\D/g, '');
            if (!phoneVal) {
                showError('formPhone', 'phoneError', 'Please enter your phone number.');
                isValid = false;
            } else if (phoneDigits.length < 10) {
                showError('formPhone', 'phoneError', 'Please enter a valid phone number.');
                isValid = false;
            } else {
                clearError('formPhone', 'phoneError');
            }
        }

        if (emailEl) {
            var emailVal = emailEl.value.trim();
            if (emailVal) {
                var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailVal)) {
                    showError('formEmail', 'emailError', 'Please enter a valid email address.');
                    isValid = false;
                } else {
                    clearError('formEmail', 'emailError');
                }
            } else {
                clearError('formEmail', 'emailError');
            }
        }

        if (serviceEl) {
            if (!serviceEl.value) {
                showError('formService', 'serviceError', 'Please select a service.');
                isValid = false;
            } else {
                clearError('formService', 'serviceError');
            }
        }

        return isValid;
    }

    // Clear errors on input
    ['formName', 'formPhone', 'formEmail', 'formService'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                var errorId = id.replace('form', '').toLowerCase() + 'Error';
                clearError(id, errorId);
            });
        }
    });

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();

            if (validateForm()) {
                var submitBtn = document.getElementById('formSubmit');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                }

                setTimeout(function () {
                    contactForm.style.display = 'none';
                    if (formSuccess) {
                        formSuccess.hidden = false;
                        formSuccess.style.display = 'block';
                    }
                }, 1200);
            }
        });
    }

    /* ============================================================
       SMOOTH SCROLL for anchor links
       ============================================================ */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                var headerOffset = 80;
                var elementPosition = targetEl.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                    top: elementPosition - headerOffset,
                    behavior: 'smooth'
                });
            }
        });
    });

    /* ============================================================
       PHONE NUMBER FORMATTING
       ============================================================ */
    var phoneInput = document.getElementById('formPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            var digits = this.value.replace(/\D/g, '');
            if (digits.length > 10) digits = digits.substring(0, 10);

            var formatted = '';
            if (digits.length > 0) formatted = '(' + digits.substring(0, 3);
            if (digits.length >= 3) formatted += ') ';
            if (digits.length > 3) formatted += digits.substring(3, 6);
            if (digits.length >= 6) formatted += '-' + digits.substring(6, 10);

            if (digits.length > 0) {
                this.value = formatted;
            }
        });
    }

    /* ============================================================
       FAQ ACCORDION
       ============================================================ */
    var faqQuestions = document.querySelectorAll('.faq__question');
    if (faqQuestions.length > 0) {
        faqQuestions.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var item = this.closest('.faq__item');
                var isOpen = item.classList.contains('is-open');

                // Close all other items in the same category
                var category = item.closest('.faq__category');
                if (category) {
                    category.querySelectorAll('.faq__item.is-open').forEach(function (openItem) {
                        if (openItem !== item) {
                            openItem.classList.remove('is-open');
                            openItem.querySelector('.faq__question').setAttribute('aria-expanded', 'false');
                        }
                    });
                }

                // Toggle current item
                item.classList.toggle('is-open');
                this.setAttribute('aria-expanded', !isOpen);
            });
        });
    }

    /* ============================================================
       ESTIMATE CALCULATOR
       ============================================================ */
    var estimateForm = document.getElementById('estimateForm');
    var estFormSuccess = document.getElementById('estFormSuccess');
    var serviceSelector = document.getElementById('serviceSelector');
    var estimateRangeBody = document.getElementById('estimateRangeBody');

    var estimatePriceData = {
        'trenchless':   { min: '$4,000', max: '$15,000+', label: 'Trenchless Sewer Replacement' },
        'sewer':        { min: '$1,500', max: '$8,000', label: 'Sewer Line Services' },
        'water-main':   { min: '$2,000', max: '$6,000', label: 'Water Main Line' },
        'drain':        { min: '$150', max: '$800', label: 'Drain Cleaning & Hydro Jetting' },
        'crawl-space':  { min: '$500', max: '$5,000', label: 'Crawl Space Plumbing' },
        'gas':          { min: '$300', max: '$3,000', label: 'Gas Line Services' },
        'water-heater': { min: '$500', max: '$3,000', label: 'Water Heater Services' },
        'general':      { min: '$100', max: '$1,500', label: 'General Plumbing' },
        'emergency':    { min: null, max: null, label: 'Emergency Plumbing' }
    };

    var selectedService = null;

    if (serviceSelector) {
        var serviceCards = serviceSelector.querySelectorAll('.service-selector__card');

        serviceCards.forEach(function (card) {
            card.addEventListener('click', function () {
                // Toggle active state
                serviceCards.forEach(function (c) { c.classList.remove('is-active'); });
                card.classList.add('is-active');
                selectedService = card.getAttribute('data-service');

                // Clear service error
                var serviceErr = document.getElementById('estServiceError');
                if (serviceErr) serviceErr.textContent = '';

                // Update price range display
                if (estimateRangeBody) {
                    var data = estimatePriceData[selectedService];
                    if (data) {
                        if (data.min === null) {
                            estimateRangeBody.innerHTML =
                                '<p class="estimate-range__service-name">' + data.label + '</p>' +
                                '<p class="estimate-range__price">Call for Pricing</p>' +
                                '<p class="estimate-range__label">Emergency service pricing varies</p>';
                        } else {
                            estimateRangeBody.innerHTML =
                                '<p class="estimate-range__service-name">' + data.label + '</p>' +
                                '<p class="estimate-range__price">' + data.min + ' &ndash; ' + data.max + '</p>' +
                                '<p class="estimate-range__label">Starting price range</p>';
                        }
                    }
                }
            });
        });
    }

    // Estimate form validation
    function validateEstimateForm() {
        var isValid = true;

        // Service selection
        if (!selectedService) {
            var serviceErr = document.getElementById('estServiceError');
            if (serviceErr) serviceErr.textContent = 'Please select a service.';
            isValid = false;
        }

        // Name
        var nameEl = document.getElementById('estName');
        if (nameEl) {
            var nameVal = nameEl.value.trim();
            if (!nameVal) {
                showError('estName', 'estNameError', 'Please enter your name.');
                isValid = false;
            } else if (nameVal.length < 2) {
                showError('estName', 'estNameError', 'Name must be at least 2 characters.');
                isValid = false;
            } else {
                clearError('estName', 'estNameError');
            }
        }

        // Phone
        var phoneEl = document.getElementById('estPhone');
        if (phoneEl) {
            var phoneVal = phoneEl.value.trim();
            var phoneDigits = phoneVal.replace(/\D/g, '');
            if (!phoneVal) {
                showError('estPhone', 'estPhoneError', 'Please enter your phone number.');
                isValid = false;
            } else if (phoneDigits.length < 10) {
                showError('estPhone', 'estPhoneError', 'Please enter a valid phone number.');
                isValid = false;
            } else {
                clearError('estPhone', 'estPhoneError');
            }
        }

        // Email (optional)
        var emailEl = document.getElementById('estEmail');
        if (emailEl) {
            var emailVal = emailEl.value.trim();
            if (emailVal) {
                var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailVal)) {
                    showError('estEmail', 'estEmailError', 'Please enter a valid email address.');
                    isValid = false;
                } else {
                    clearError('estEmail', 'estEmailError');
                }
            } else {
                clearError('estEmail', 'estEmailError');
            }
        }

        return isValid;
    }

    // Clear errors on input for estimate form fields
    ['estName', 'estPhone', 'estEmail'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                var errorId = id + 'Error';
                clearError(id, errorId);
            });
        }
    });

    // Phone formatting for estimate form
    var estPhoneInput = document.getElementById('estPhone');
    if (estPhoneInput) {
        estPhoneInput.addEventListener('input', function () {
            var digits = this.value.replace(/\D/g, '');
            if (digits.length > 10) digits = digits.substring(0, 10);

            var formatted = '';
            if (digits.length > 0) formatted = '(' + digits.substring(0, 3);
            if (digits.length >= 3) formatted += ') ';
            if (digits.length > 3) formatted += digits.substring(3, 6);
            if (digits.length >= 6) formatted += '-' + digits.substring(6, 10);

            if (digits.length > 0) {
                this.value = formatted;
            }
        });
    }

    // Estimate form submission
    if (estimateForm) {
        estimateForm.addEventListener('submit', function (e) {
            e.preventDefault();

            if (validateEstimateForm()) {
                var submitBtn = document.getElementById('estSubmit');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                }

                setTimeout(function () {
                    estimateForm.style.display = 'none';
                    if (estFormSuccess) {
                        estFormSuccess.hidden = false;
                        estFormSuccess.style.display = 'block';
                    }
                }, 1200);
            }
        });
    }

    /* ============================================================
       GALLERY FILTER (Tab-based image grid)
       ============================================================ */
    var galleryTabs = document.querySelectorAll('.gallery__tab');
    var galleryPhotos = document.querySelectorAll('.gallery__photo');

    if (galleryTabs.length > 0 && galleryPhotos.length > 0) {
        galleryTabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var filter = this.dataset.filter;

                // Update active tab
                galleryTabs.forEach(function (t) { t.classList.remove('is-active'); });
                this.classList.add('is-active');

                // Filter photos
                galleryPhotos.forEach(function (photo) {
                    if (filter === 'all' || photo.dataset.category === filter) {
                        photo.style.display = '';
                    } else {
                        photo.style.display = 'none';
                    }
                });
            });
        });
    }

})();

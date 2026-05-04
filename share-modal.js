(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function openShareModal() {
    var modal = byId('share-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeShareModal() {
    var modal = byId('share-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function bindShareModalEvents() {
    var openBtn = byId('share-btn');
    var closeBtn = byId('share-close');
    var modal = byId('share-modal');

    if (openBtn) {
      openBtn.addEventListener('click', openShareModal);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeShareModal);
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeShareModal();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindShareModalEvents);
  } else {
    bindShareModalEvents();
  }

  // Optional globals for older inline handlers.
  window.openShareModal = window.openShareModal || openShareModal;
  window.closeShareModal = window.closeShareModal || closeShareModal;
})();

(function () {
    document.querySelectorAll('[data-page-action="reload"]').forEach(function (reloadLink) {
        reloadLink.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.reload();
        });
    });
}());

// settings.js
document.addEventListener('DOMContentLoaded', function() {
    initSettingsForm();
    initDeleteButton();
});

function initSettingsForm() {
    const form = document.getElementById('basicSettingsForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Настройки сохранены!');
    });
}

function initDeleteButton() {
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (!deleteBtn) return;
    
    deleteBtn.addEventListener('click', function() {
        if (confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.')) {
            localStorage.clear();
            alert('Аккаунт удален. Вы будете перенаправлены на главную страницу.');
            window.location.href = 'index.html';
        }
    });
}
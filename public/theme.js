// theme.js
const toggleButton = document.getElementById('toggle-theme');

// Check if dark mode is enabled in local storage
if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    document.querySelector('header').classList.add('dark-mode');
    document.querySelector('footer').classList.add('dark-mode');
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
        task.classList.add('dark-mode'); // Add dark mode class to existing tasks
    });
}

// Toggle dark mode
toggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.querySelector('header').classList.toggle('dark-mode');
    document.querySelector('footer').classList.toggle('dark-mode');

    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
        task.classList.toggle('dark-mode'); // Toggle dark mode class for tasks
    });

    // Save the current theme in local storage
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('darkMode', 'enabled');
    } else {
        localStorage.setItem('darkMode', 'disabled');
    }
});

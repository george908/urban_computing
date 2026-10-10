const start_button = document.getElementById("start_button"); // the start button from the page
const stop_button = document.getElementById("stop_button"); // the stop button from the page
const is_running = document.getElementById("is_running"); // the is running red and green box from the page

// change the colour of the box to green when its running 
start_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "green";
});
// change it to red when stop button clicked
stop_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "red";
});
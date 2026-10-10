const start_button = document.getElementById("start_button"); // the start button from the page
const stop_button = document.getElementById("stop_button"); // the stop button from the page
const is_running = document.getElementById("is_running"); // the is running red and green box from the page
const the_position_values = document.getElementById("the_position_values"); // the place to add the postion values 

// get the acceleration of the motion and show it in the x y and z values in the HTML 
function get_acceleration(motion){
    const acceleration = motion.acceleration;
    if (acceleration) {
        the_position_values.innerHTML = "X = " + acceleration.x + "<br>" + "Y = " + acceleration.y + "<br>" + "Z = " + acceleration.z;
    }
}

// change the colour of the box to green if the start button was clicked and the 
// permission to the motion sensors was granted
start_button.addEventListener("click", async function() {
    const permission = await DeviceMotionEvent.requestPermission();
    if (permission === "granted") {
        is_running.style.backgroundColor = "green"; // turn it green 
        window.addEventListener("devicemotion", get_acceleration); // call the function to get the aceleration 
    }
});

// change it to red when stop button clicked
stop_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "red"; // turn it red
    window.removeEventListener("devicemotion", get_acceleration); // stop calling the get aceleration function
});
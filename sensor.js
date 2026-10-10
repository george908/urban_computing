const start_button = document.getElementById("start_button"); // the start button from the page
const stop_button = document.getElementById("stop_button"); // the stop button from the page
const is_running = document.getElementById("is_running"); // the is running red and green box from the page
const the_position_values = document.getElementById("the_position_values"); // the place to add the postion values 
const csv_data = [] // array for the csv data 

// get the acceleration of the motion and show it in the x y and z values in the HTML 
function get_acceleration(motion){
    const acceleration = motion.acceleration;
    if (acceleration) {
        the_position_values.innerHTML = "X = " + acceleration.x + "<br>" + "Y = " + acceleration.y + "<br>" + "Z = " + acceleration.z; // show the values on the web page
        csv_data.push({time: Date.now(), x: acceleration.x, y: acceleration.y, z: acceleration.z}); // add the values to the array to be sorted 
    }
}

// change the colour of the box to green if the start button was clicked and the 
// permission to the motion sensors was granted
start_button.addEventListener("click", async function() {
    const permission = await DeviceMotionEvent.requestPermission();
    if (permission === "granted") {
        is_running.style.backgroundColor = "green"; // turn it green 
        csv_data.length = 0; // turn the length of the array into 0 so that it removes the old recored array
        window.addEventListener("devicemotion", get_acceleration); // call the function to get the aceleration 
    }
});

// change it to red when stop button clicked and create and export the csv
stop_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "red"; // turn it red
    window.removeEventListener("devicemotion", get_acceleration); // stop calling the get aceleration function
    
    // create and export the csv
    let csv = "time,x,y,z\n"; // make the headings of the csv
    // seperate each value in the array by a comma
    for (const value of csv_data) {
        csv = csv + (value.time + "," + value.x + "," + value.y + "," + value.z + "\n");
    }
    const file = new Blob([csv], {type: "text/csv"}); // create the a file with the csv values
    const link = document.createElement("a"); // make the link for the file 
    link.href = URL.createObjectURL(file); // make the link point at the file
    link.download = "acceleration_valuues.csv";
    link.click();
});
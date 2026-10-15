const start_button = document.getElementById("start_button"); // the start button from the page
const stop_button = document.getElementById("stop_button"); // the stop button from the page
const is_running = document.getElementById("is_running"); // the is running red and green box from the page
// const the_position_values = document.getElementById("the_position_values"); // the place to add the postion values 
const csv_data = [] // array for the csv data 
const the_gps_values = document.getElementById("the_gps_values"); // the place to add the gps values 
let gps_id = null; // the changable GPS ID 

/*
// get the acceleration of the motion and show it in the x y and z values in the HTML 
function get_acceleration(motion){
    const acceleration = motion.acceleration;
    if (acceleration) {
        the_position_values.innerHTML = "X = " + acceleration.x + "<br>" + "Y = " + acceleration.y + "<br>" + "Z = " + acceleration.z; // show the values on the web page
        csv_data.push([Date.now(), "acceleration", acceleration.x, acceleration.y, acceleration.z, "", "", "", ""]); // add the values to the array to be sorted 
    }
}
*/

// get the postion and speed to show on the hompage and download
function get_location(position) {
    const location = position.coords;
    the_gps_values.innerHTML = "Latitude = " + location.latitude + "<br>" + "Longitude = " + location.longitude + "<br>" + "Speed = " + location.speed + "<br>" + "Accuracy = " + location.accuracy;
    csv_data.push([position.timestamp, location.latitude, location.longitude, location.speed, location.accuracy]);
}

/*
// change the colour of the box to green if the start button was clicked and the 
// permission to the motion sensors was granted
start_button.addEventListener("click", async function() {
    const permission = await DeviceMotionEvent.requestPermission();
    if (permission === "granted") {
        is_running.style.backgroundColor = "green"; // turn it green 
        csv_data.length = 0; // turn the length of the array into 0 so that it removes the old recored array
        window.addEventListener("devicemotion", get_acceleration); // call the function to get the aceleration 
        // start the gps tracker and save the id 
        gps_id = navigator.geolocation.watchPosition(get_location, null, {enableHighAccuracy: true});
    }
});
*/

start_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "green"; // turn it green
    csv_data.length = 0; // turn the length of the array into 0 so that it removes the old recored array
    // start the gps tracker and save the id 
    gps_id = navigator.geolocation.watchPosition(get_location, null, {enableHighAccuracy: true});
});

// change it to red when stop button clicked and create and export the csv
stop_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "red"; // turn it red
    // window.removeEventListener("devicemotion", get_acceleration); // stop calling the get aceleration function
    // stop the gps tracker 
    if (gps_id !== null) {
        navigator.geolocation.clearWatch(gps_id);
        gps_id = null;
    }
    
    // create and export the csv
    let csv = "time,latitude,longitude,speed_mps,accuracy_m\n"; // make the headings of the csv
    // seperate each value in the array by a comma
    for (const value of csv_data) {
        csv = csv + value.join(",") + "\n";
    }
    const file = new Blob([csv], {type: "text/csv"}); // create the a file with the csv values
    const link = document.createElement("a"); // make the link for the file 
    link.href = URL.createObjectURL(file); // make the link point at the file
    link.download = "GPS_values.csv";
    link.click();
});
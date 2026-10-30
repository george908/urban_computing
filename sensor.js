const start_button = document.getElementById("start_button"); // the start button from the page
const stop_button = document.getElementById("stop_button"); // the stop button from the page
const is_running = document.getElementById("is_running"); // the is running red and green box from the page
const csv_data = [] // array for the csv data 
const the_gps_values = document.getElementById("the_gps_values"); // the place to add the gps values 
let gps_id = null; // the changable GPS ID 

// get the postion and speed to show on the hompage and download
function get_location(position) {
    const location = position.coords;
    the_gps_values.innerHTML = "Latitude = " + location.latitude + "<br>" + "Longitude = " + location.longitude + "<br>" + "Speed = " + location.speed + "<br>" + "Accuracy = " + location.accuracy;
    csv_data.push([position.timestamp, location.latitude, location.longitude, location.speed, location.accuracy]);
}

start_button.addEventListener("click", function() {
    // make sure that it isnt already recording
    if(gps_id !== null){
        return;
    }
    const journey_running_in_firebase = start_recording_journey();
    // only actually run the journey if it is successfully running in firebase
    if(journey_running_in_firebase === true){
        is_running.style.backgroundColor = "green"; // turn it green
        csv_data.length = 0; // turn the length of the array into 0 so that it removes the old recored array
        // start the gps tracker and save the id 
        gps_id = navigator.geolocation.watchPosition(get_location, null, {enableHighAccuracy: true});
    }
});

// change it to red when stop button clicked and create and export the csv
stop_button.addEventListener("click", function() {
    is_running.style.backgroundColor = "red"; // turn it red
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

const firebase_authentication = firebase.auth();
const login_page = document.getElementById("login_with_Google");
const main_page = document.getElementById("on_main_page");
const login_button = document.getElementById("login_button");
const firestore_database = firebase.firestore();
const train_select = document.getElementById("train_select");


// check if the user is logged in and hide the login page if they are or hide the main page if the arent
firebase_authentication.onAuthStateChanged(function(current_user) {
    login_page.hidden = (current_user !== null);
    main_page.hidden = (current_user === null);
    if (current_user !== null) {
        load_list_of_trains();
    }
});

// get the google authentication popup to login to the main page
login_button.addEventListener("click", function() {
    const google_auth = new firebase.auth.GoogleAuthProvider();
    firebase_authentication.signInWithPopup(google_auth).catch(function(error) {
        console.error(error);
        document.getElementById("the_login_error").textContent = error.message;
    });
});

let current_journey_recording = null;
let journey_created = null;
// function to record the journey into the firebase database when the start button is pressed 
function start_recording_journey() {
    // dont make a new journey if there is one already going
    if (current_journey_recording !== null) {
        return false;
    }
    // make sure that the user is logged in properly so the database doesnt log no user or a garbage user
    const current_user = firebase_authentication.currentUser;
    if (current_user === null ){
        console.error("you are not logged in correctly");
        return false;
    }
    // the train code of the train selected from the dropdown
    const selected_train_code = train_select.value; 
    // make sure the user selects a train before recording 
    if (selected_train_code === "") {
        alert("You have to select a train before you start to record");
        return false;
    }
    // get the user's folder
    const current_users_folder = firestore_database.collection("users").doc(current_user.uid);
    // make a new journey with a unique ID
    current_journey_recording = current_users_folder.collection("journeys").doc();
    const new_journey = current_journey_recording;

    // get there email so that it is in the users folder 
    journey_created = current_users_folder.set({email: current_user.email}, {merge: true}).then(function() {
        // get the start time of the journey to add to the top of the doc
        return new_journey.set({
            started_at: firebase.firestore.FieldValue.serverTimestamp(), 
            train_code: selected_train_code
        });
    });
    return true;
}

function add_recording_values(position) {
    // only add values if the journey is currently running
    if(current_journey_recording === null){
        return;
    }
    // remember the journey that this GPS reading belongs to 
    const recording_journey = current_journey_recording;
    // when the journey has been created properly add the values from the gps sensor
    journey_created.then(function(){
        return recording_journey.collection("recordings").add({time: position.timestamp, latitude: position.coords.latitude, longitude: position.coords.longitude, speed_mps: position.coords.speed, accuracy_m: position.coords.accuracy});
    }).catch(function(error){
        console.error("GPS upload failed:", error);
    });
}

function load_list_of_trains(){
    // chose the latest train update in the Dalkey database 
    firestore_database.collection("stations").doc("Dalkey").collection("train_updates").orderBy("recorded_at", "desc").limit(1).get().then(function(results) { 
            // only add the last train option and remove the others
            train_select.options.length = 1;
            const latest_set_of_train_data = results.docs[0].data(); // the last document full of the train results 
            // loop through all of the trains and make a dropdown choice for each train 
            for (const train of latest_set_of_train_data.train_results) { 
                const option = document.createElement("option");
                option.value = train.train_code; 
                option.textContent = train.train_direction + " - arriving in " + train.due_in_minutes + " minutes";
                train_select.appendChild(option);
            }
        })
        .catch(function(error) { 
            console.error(error);
            train_select.options[0].textContent = "There is an error loading the train data"; 
        });

}


